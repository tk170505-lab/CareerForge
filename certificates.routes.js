import express from 'express';
import multer from 'multer';
import { queryAll, queryOne, withTransaction } from '../config/db.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { requireFields, sanitizeText } from '../middleware/validate.js';
import { logActivity } from '../middleware/auditLogger.js';
import { cache } from '../utils/cache.js';
import {
  generateVerificationCode,
  resolveSafeCertificatePath,
  storeCertificateArtifact,
} from '../services/storageService.js';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /\.(pdf|png|jpe?g|txt)$/i.test(file.originalname || '');
    if (!allowed) {
      return cb(new Error('Only PDF, PNG, JPG, or TXT certificate files are allowed.'));
    }
    cb(null, true);
  },
});

router.get('/', authenticate, (req, res) => {
  if (req.user.role === 'learner') {
    const certificates = queryAll(
      `SELECT c.*, s.name AS skill_name
       FROM certificates c
       LEFT JOIN skills s ON s.id = c.skill_id
       WHERE c.user_id = ?
       ORDER BY c.uploaded_at DESC`,
      req.user.id
    );
    return res.json({ certificates });
  }

  const statusFilter = req.query.status;
  const certificates = statusFilter
    ? queryAll(
        `SELECT c.*, u.full_name AS learner_name, u.email AS learner_email, s.name AS skill_name
         FROM certificates c
         JOIN users u ON u.id = c.user_id
         LEFT JOIN skills s ON s.id = c.skill_id
         WHERE c.status = ?
         ORDER BY c.uploaded_at DESC`,
        statusFilter
      )
    : queryAll(
        `SELECT c.*, u.full_name AS learner_name, u.email AS learner_email, s.name AS skill_name
         FROM certificates c
         JOIN users u ON u.id = c.user_id
         LEFT JOIN skills s ON s.id = c.skill_id
         ORDER BY c.uploaded_at DESC`
      );
  return res.json({ certificates });
});

// Public verification lookup by code
router.get('/verify/:code', (req, res) => {
  const code = sanitizeText(req.params.code, 64).toUpperCase();
  const cert = queryOne(
    `SELECT * FROM vw_verified_certificates WHERE verification_code = ?`,
    code
  );
  if (!cert) {
    return res.status(404).json({ valid: false, error: 'Certificate verification code not found.' });
  }

  const history = queryAll(
    `SELECT cv.decision, cv.notes, cv.verified_at, u.full_name AS verifier_name
     FROM certificate_verifications cv
     LEFT JOIN users u ON u.id = cv.verifier_id
     WHERE cv.certificate_id = ?
     ORDER BY cv.verified_at DESC`,
    cert.certificate_id
  );

  return res.json({
    valid: cert.status === 'VERIFIED',
    certificate: cert,
    history,
  });
});

router.get('/files/:filename', authenticate, (req, res) => {
  const filePath = resolveSafeCertificatePath(req.params.filename);
  if (!filePath) {
    return res.status(404).json({ error: 'Certificate file not found.' });
  }
  return res.sendFile(filePath);
});

router.post('/', authenticate, authorizeRoles('learner'), upload.single('file'), async (req, res) => {
  const missing = requireFields(req.body, ['title', 'issuer', 'issued_date']);
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing fields: ${missing.join(', ')}` });
  }

  const title = sanitizeText(req.body.title, 180);
  const issuer = sanitizeText(req.body.issuer, 150);
  const issuedDate = sanitizeText(req.body.issued_date, 20);
  const skillId = req.body.skill_id ? Number(req.body.skill_id) : null;

  if (skillId) {
    const skill = queryOne('SELECT id FROM skills WHERE id = ?', skillId);
    if (!skill) return res.status(404).json({ error: 'Referenced skill not found.' });
  }

  const verificationCode = generateVerificationCode();
  const stored = await storeCertificateArtifact({
    originalName: req.file?.originalname || `${title.toLowerCase().replace(/\s+/g, '-')}.txt`,
    buffer: req.file?.buffer,
    title,
    issuer,
    learnerEmail: req.user.email,
  });

  const certId = withTransaction((db) => {
    const ins = db
      .prepare(
        `INSERT INTO certificates (user_id, skill_id, title, issuer, issued_date, verification_code, file_name, blob_url, file_hash_sha256, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')`
      )
      .run(
        req.user.id,
        skillId,
        title,
        issuer,
        issuedDate,
        verificationCode,
        stored.fileName,
        stored.blobUrl,
        stored.fileHashSha256
      );
    const id = Number(ins.lastInsertRowid);

    db.prepare(
      `INSERT INTO certificate_verifications (certificate_id, verifier_id, decision, notes)
       VALUES (?, NULL, 'PENDING', 'Uploaded and queued for verification')`
    ).run(id);

    return id;
  });

  cache.invalidatePrefix('analytics:');
  logActivity({
    userId: req.user.id,
    action: 'CERTIFICATE_UPLOADED',
    entityType: 'certificate',
    entityId: certId,
    details: `Uploaded "${title}" (${verificationCode}, storage=${stored.storageMode})`,
    ipAddress: req.ip,
  });

  const certificate = queryOne(
    `SELECT c.*, s.name AS skill_name
     FROM certificates c LEFT JOIN skills s ON s.id = c.skill_id
     WHERE c.id = ?`,
    certId
  );

  return res.status(201).json({ certificate, storageMode: stored.storageMode });
});

router.patch('/:id/verify', authenticate, authorizeRoles('verifier', 'educator'), (req, res) => {
  const certId = Number(req.params.id);
  const decision = req.body?.decision;
  const notes = sanitizeText(req.body?.notes || '', 500) || null;

  if (!['VERIFIED', 'REJECTED'].includes(decision)) {
    return res.status(400).json({ error: "decision must be 'VERIFIED' or 'REJECTED'." });
  }

  const cert = queryOne('SELECT * FROM certificates WHERE id = ?', certId);
  if (!cert) {
    return res.status(404).json({ error: 'Certificate not found.' });
  }

  // Atomic transaction mirroring sp_VerifyCertificate
  withTransaction((db) => {
    db.prepare('UPDATE certificates SET status = ? WHERE id = ?').run(decision, certId);

    db.prepare(
      `INSERT INTO certificate_verifications (certificate_id, verifier_id, decision, notes)
       VALUES (?, ?, ?, ?)`
    ).run(certId, req.user.id, decision, notes);

    if (decision === 'VERIFIED' && cert.skill_id) {
      const existingSkill = db
        .prepare('SELECT * FROM user_skills WHERE user_id = ? AND skill_id = ?')
        .get(cert.user_id, cert.skill_id);
      if (existingSkill) {
        db.prepare(
          `UPDATE user_skills
           SET verified = 1, source = 'certificate', last_assessed_at = datetime('now')
           WHERE user_id = ? AND skill_id = ?`
        ).run(cert.user_id, cert.skill_id);
      } else {
        db.prepare(
          `INSERT INTO user_skills (user_id, skill_id, proficiency_level, verified, source)
           VALUES (?, ?, 3, 1, 'certificate')`
        ).run(cert.user_id, cert.skill_id);
      }
    }
  });

  cache.invalidatePrefix('analytics:');
  const updated = queryOne(
    `SELECT c.*, u.full_name AS learner_name, s.name AS skill_name
     FROM certificates c
     JOIN users u ON u.id = c.user_id
     LEFT JOIN skills s ON s.id = c.skill_id
     WHERE c.id = ?`,
    certId
  );

  return res.json({ certificate: updated });
});

export default router;
