import express from 'express';
import bcrypt from 'bcryptjs';
import { queryAll, queryOne, run } from '../config/db.js';
import { authenticate, signToken } from '../middleware/auth.js';
import { isValidEmail, requireFields, sanitizeText } from '../middleware/validate.js';
import { logActivity } from '../middleware/auditLogger.js';

const router = express.Router();

const ALLOWED_ROLES = ['learner', 'educator', 'employer', 'verifier'];

router.get('/demo-accounts', (_req, res) => {
  const users = queryAll(
    `SELECT id, full_name, email, role, headline, organization, target_role
     FROM users
     WHERE email LIKE '%@careerforge.dev'
     ORDER BY id ASC`
  );
  res.json({ accounts: users, demoPassword: 'Password123!' });
});

router.post('/register', (req, res) => {
  const missing = requireFields(req.body, ['full_name', 'email', 'password']);
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
  }

  const fullName = sanitizeText(req.body.full_name, 120);
  const email = sanitizeText(req.body.email, 180).toLowerCase();
  const password = String(req.body.password);
  const role = ALLOWED_ROLES.includes(req.body.role) ? req.body.role : 'learner';
  const headline = sanitizeText(req.body.headline || '', 200) || null;
  const organization = sanitizeText(req.body.organization || '', 150) || null;
  const targetRole = sanitizeText(req.body.target_role || '', 120) || null;

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email address format.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }

  const existing = queryOne('SELECT id FROM users WHERE email = ?', email);
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = run(
    `INSERT INTO users (full_name, email, password_hash, role, headline, organization, target_role)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    fullName,
    email,
    passwordHash,
    role,
    headline,
    organization,
    targetRole
  );

  const user = queryOne(
    'SELECT id, full_name, email, role, headline, organization, target_role, created_at FROM users WHERE id = ?',
    Number(result.lastInsertRowid)
  );
  const token = signToken(user);

  logActivity({
    userId: user.id,
    action: 'USER_REGISTERED',
    entityType: 'user',
    entityId: user.id,
    details: `Registered as ${role}`,
    ipAddress: req.ip,
  });

  return res.status(201).json({ token, user });
});

router.post('/login', (req, res) => {
  const missing = requireFields(req.body, ['email', 'password']);
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing required fields: ${missing.join(', ')}` });
  }

  const email = sanitizeText(req.body.email, 180).toLowerCase();
  const password = String(req.body.password);

  const userRow = queryOne('SELECT * FROM users WHERE email = ? AND is_active = 1', email);
  if (!userRow || !bcrypt.compareSync(password, userRow.password_hash)) {
    logActivity({
      action: 'LOGIN_FAILED',
      entityType: 'user',
      details: `Failed login attempt for ${email}`,
      ipAddress: req.ip,
    });
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const user = {
    id: userRow.id,
    full_name: userRow.full_name,
    email: userRow.email,
    role: userRow.role,
    headline: userRow.headline,
    organization: userRow.organization,
    target_role: userRow.target_role,
  };
  const token = signToken(user);

  logActivity({
    userId: user.id,
    action: 'USER_LOGIN',
    entityType: 'user',
    entityId: user.id,
    details: `Signed in (${user.role})`,
    ipAddress: req.ip,
  });

  return res.json({ token, user });
});

router.get('/me', authenticate, (req, res) => {
  const user = queryOne(
    'SELECT id, full_name, email, role, headline, organization, target_role, created_at FROM users WHERE id = ?',
    req.user.id
  );
  if (!user) return res.status(404).json({ error: 'User not found.' });
  return res.json({ user });
});

export default router;
