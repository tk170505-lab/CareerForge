import express from 'express';
import { queryAll, queryOne, run, withTransaction } from '../config/db.js';
import { authenticate, authorizeRoles, optionalAuth } from '../middleware/auth.js';
import { clampInt, requireFields, sanitizeText } from '../middleware/validate.js';
import { logActivity } from '../middleware/auditLogger.js';
import { cache } from '../utils/cache.js';
import { buildUserSkillMap, computeJobMatch } from '../services/matchingService.js';

const router = express.Router();

function loadAllJobsBase() {
  const cached = cache.get('jobs:open');
  if (cached) return { jobs: cached, fromCache: true };

  const jobs = queryAll(`
    SELECT j.*, u.full_name AS employer_name
    FROM jobs j
    JOIN users u ON u.id = j.employer_id
    WHERE j.is_open = 1
    ORDER BY j.id DESC
  `);
  const reqs = queryAll(`
    SELECT js.*, s.name AS skill_name, s.category
    FROM job_skills js
    JOIN skills s ON s.id = js.skill_id
  `);

  const hydrated = jobs.map((j) => ({
    ...j,
    requiredSkills: reqs.filter((r) => r.job_id === j.id),
  }));
  cache.set('jobs:open', hydrated, 30_000);
  return { jobs: hydrated, fromCache: false };
}

router.get('/', optionalAuth, (req, res) => {
  const { jobs, fromCache } = loadAllJobsBase();
  res.setHeader('X-Cache', fromCache ? 'HIT' : 'MISS');

  if (!req.user || req.user.role !== 'learner') {
    return res.json({ jobs });
  }

  const userSkills = queryAll('SELECT * FROM user_skills WHERE user_id = ?', req.user.id);
  const skillMap = buildUserSkillMap(userSkills);
  const apps = queryAll('SELECT job_id, status, applied_at FROM applications WHERE user_id = ?', req.user.id);
  const appMap = new Map(apps.map((a) => [a.job_id, a]));

  const matched = jobs
    .map((job) => ({
      ...job,
      match: computeJobMatch(skillMap, job.requiredSkills),
      myApplication: appMap.get(job.id) || null,
    }))
    .sort((a, b) => b.match.matchScore - a.match.matchScore);

  return res.json({ jobs: matched });
});

router.post('/', authenticate, authorizeRoles('employer'), (req, res) => {
  const missing = requireFields(req.body, ['title', 'company', 'location', 'description']);
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing fields: ${missing.join(', ')}` });
  }

  const title = sanitizeText(req.body.title, 180);
  const company = sanitizeText(req.body.company, 150);
  const location = sanitizeText(req.body.location, 120);
  const employmentType = sanitizeText(req.body.employment_type || 'Full-time', 40);
  const salaryRange = sanitizeText(req.body.salary_range || '', 80) || null;
  const description = sanitizeText(req.body.description, 1500);
  const skills = Array.isArray(req.body.skills) ? req.body.skills : [];

  const jobId = withTransaction((db) => {
    const ins = db
      .prepare(
        `INSERT INTO jobs (employer_id, title, company, location, employment_type, salary_range, description, is_open)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1)`
      )
      .run(req.user.id, title, company, location, employmentType, salaryRange, description);
    const id = Number(ins.lastInsertRowid);

    const insertReq = db.prepare(
      'INSERT OR REPLACE INTO job_skills (job_id, skill_id, required_level, is_mandatory) VALUES (?, ?, ?, ?)'
    );
    for (const s of skills) {
      if (s.skill_id) {
        insertReq.run(
          id,
          Number(s.skill_id),
          clampInt(s.required_level, 1, 5, 3),
          s.is_mandatory === false ? 0 : 1
        );
      }
    }
    return id;
  });

  cache.invalidatePrefix('jobs:');
  cache.invalidatePrefix('analytics:');
  logActivity({
    userId: req.user.id,
    action: 'JOB_CREATED',
    entityType: 'job',
    entityId: jobId,
    details: `Posted "${title}" at ${company}`,
    ipAddress: req.ip,
  });

  const job = queryOne('SELECT * FROM jobs WHERE id = ?', jobId);
  return res.status(201).json({ job });
});

router.post('/:id/apply', authenticate, authorizeRoles('learner'), (req, res) => {
  const jobId = Number(req.params.id);
  const coverNote = sanitizeText(req.body?.cover_note || '', 1000) || null;

  const job = queryOne('SELECT * FROM jobs WHERE id = ? AND is_open = 1', jobId);
  if (!job) return res.status(404).json({ error: 'Open job not found.' });

  const existing = queryOne(
    'SELECT * FROM applications WHERE job_id = ? AND user_id = ?',
    jobId,
    req.user.id
  );
  if (existing) {
    return res.status(409).json({ error: 'You have already applied for this job.', application: existing });
  }

  const userSkills = queryAll('SELECT * FROM user_skills WHERE user_id = ?', req.user.id);
  const reqs = queryAll(
    `SELECT js.*, s.name AS skill_name, s.category
     FROM job_skills js JOIN skills s ON s.id = js.skill_id
     WHERE js.job_id = ?`,
    jobId
  );
  const match = computeJobMatch(buildUserSkillMap(userSkills), reqs);

  const result = run(
    `INSERT INTO applications (job_id, user_id, match_score, status, cover_note)
     VALUES (?, ?, ?, 'APPLIED', ?)`,
    jobId,
    req.user.id,
    match.matchScore,
    coverNote
  );

  cache.invalidatePrefix('analytics:');
  logActivity({
    userId: req.user.id,
    action: 'JOB_APPLIED',
    entityType: 'application',
    entityId: Number(result.lastInsertRowid),
    details: `Applied to "${job.title}" with ${match.matchScore}% skill match`,
    ipAddress: req.ip,
  });

  const application = queryOne('SELECT * FROM applications WHERE id = ?', Number(result.lastInsertRowid));
  return res.status(201).json({ application, match });
});

router.get('/my/applications', authenticate, authorizeRoles('learner'), (req, res) => {
  const applications = queryAll(
    `SELECT a.*, j.title AS job_title, j.company, j.location, j.salary_range
     FROM applications a
     JOIN jobs j ON j.id = a.job_id
     WHERE a.user_id = ?
     ORDER BY a.applied_at DESC`,
    req.user.id
  );
  res.json({ applications });
});

router.get('/:id/applicants', authenticate, authorizeRoles('employer'), (req, res) => {
  const jobId = Number(req.params.id);
  const job = queryOne('SELECT * FROM jobs WHERE id = ? AND employer_id = ?', jobId, req.user.id);
  if (!job) {
    return res.status(404).json({ error: 'Job not found or not owned by your employer account.' });
  }

  const applicants = queryAll(
    `SELECT a.*, u.full_name, u.email, u.headline, u.organization,
            (SELECT COUNT(*) FROM certificates c WHERE c.user_id = u.id AND c.status = 'VERIFIED') AS verified_certs_count,
            (SELECT COUNT(*) FROM user_skills us WHERE us.user_id = u.id AND us.verified = 1) AS verified_skills_count
     FROM applications a
     JOIN users u ON u.id = a.user_id
     WHERE a.job_id = ?
     ORDER BY a.match_score DESC, verified_certs_count DESC`,
    jobId
  );

  return res.json({ job, applicants });
});

router.patch('/applications/:appId/status', authenticate, authorizeRoles('employer'), (req, res) => {
  const appId = Number(req.params.appId);
  const nextStatus = req.body?.status;
  if (!['APPLIED', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'REJECTED'].includes(nextStatus)) {
    return res.status(400).json({ error: 'Invalid application status.' });
  }

  const appRow = queryOne(
    `SELECT a.*, j.employer_id
     FROM applications a JOIN jobs j ON j.id = a.job_id
     WHERE a.id = ?`,
    appId
  );
  if (!appRow || appRow.employer_id !== req.user.id) {
    return res.status(404).json({ error: 'Application not found for your jobs.' });
  }

  run(
    `UPDATE applications SET status = ?, updated_at = datetime('now') WHERE id = ?`,
    nextStatus,
    appId
  );
  cache.invalidatePrefix('analytics:');

  const updated = queryOne('SELECT * FROM applications WHERE id = ?', appId);
  return res.json({ application: updated });
});

export default router;
