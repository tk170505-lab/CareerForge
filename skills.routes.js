import express from 'express';
import { queryAll, queryOne, run } from '../config/db.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { clampInt, requireFields } from '../middleware/validate.js';
import { cache } from '../utils/cache.js';
import { buildUserSkillMap, computeJobMatch, recommendCoursesForGaps } from '../services/matchingService.js';

const router = express.Router();

router.get('/', (_req, res) => {
  const cached = cache.get('skills:all');
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.json({ skills: cached });
  }
  const skills = queryAll('SELECT * FROM skills ORDER BY category ASC, name ASC');
  cache.set('skills:all', skills, 60_000);
  res.setHeader('X-Cache', 'MISS');
  return res.json({ skills });
});

router.get('/my', authenticate, (req, res) => {
  const skills = queryAll(
    `SELECT us.*, s.name AS skill_name, s.category, s.description
     FROM user_skills us
     JOIN skills s ON s.id = us.skill_id
     WHERE us.user_id = ?
     ORDER BY us.proficiency_level DESC, s.name ASC`,
    req.user.id
  );
  return res.json({ skills });
});

router.post('/my', authenticate, authorizeRoles('learner'), (req, res) => {
  const missing = requireFields(req.body, ['skill_id', 'proficiency_level']);
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing fields: ${missing.join(', ')}` });
  }

  const skillId = Number(req.body.skill_id);
  const level = clampInt(req.body.proficiency_level, 1, 5, 1);

  const skill = queryOne('SELECT id, name FROM skills WHERE id = ?', skillId);
  if (!skill) {
    return res.status(404).json({ error: 'Skill not found.' });
  }

  const existing = queryOne(
    'SELECT * FROM user_skills WHERE user_id = ? AND skill_id = ?',
    req.user.id,
    skillId
  );

  if (existing) {
    run(
      `UPDATE user_skills
       SET proficiency_level = ?,
           source = CASE WHEN verified = 1 THEN source ELSE 'self' END,
           last_assessed_at = datetime('now')
       WHERE user_id = ? AND skill_id = ?`,
      level,
      req.user.id,
      skillId
    );
  } else {
    run(
      `INSERT INTO user_skills (user_id, skill_id, proficiency_level, verified, source)
       VALUES (?, ?, ?, 0, 'self')`,
      req.user.id,
      skillId,
      level
    );
  }

  cache.invalidatePrefix('analytics:');
  const updated = queryOne(
    `SELECT us.*, s.name AS skill_name, s.category
     FROM user_skills us JOIN skills s ON s.id = us.skill_id
     WHERE us.user_id = ? AND us.skill_id = ?`,
    req.user.id,
    skillId
  );
  return res.json({ skill: updated });
});

router.get('/gap-analysis', authenticate, (req, res) => {
  const userSkills = queryAll(
    `SELECT us.*, s.name AS skill_name, s.category
     FROM user_skills us
     JOIN skills s ON s.id = us.skill_id
     WHERE us.user_id = ?`,
    req.user.id
  );
  const skillMap = buildUserSkillMap(userSkills);

  const jobs = req.query.jobId
    ? queryAll('SELECT * FROM jobs WHERE id = ? AND is_open = 1', Number(req.query.jobId))
    : queryAll('SELECT * FROM jobs WHERE is_open = 1 ORDER BY id ASC');

  if (jobs.length === 0) {
    return res.status(404).json({ error: 'No matching target job found.' });
  }

  const targetJob = jobs[0];
  const requirements = queryAll(
    `SELECT js.*, s.name AS skill_name, s.category
     FROM job_skills js
     JOIN skills s ON s.id = js.skill_id
     WHERE js.job_id = ?`,
    targetJob.id
  );

  const analysis = computeJobMatch(skillMap, requirements);

  const courses = queryAll('SELECT * FROM courses');
  const courseSkills = queryAll(
    `SELECT cs.*, s.name AS skill_name
     FROM course_skills cs
     JOIN skills s ON s.id = cs.skill_id`
  );
  const enrolledRows = queryAll('SELECT course_id FROM enrollments WHERE user_id = ?', req.user.id);
  const enrolledSet = new Set(enrolledRows.map((r) => r.course_id));

  const coursesWithSkills = courses.map((c) => ({
    ...c,
    skills: courseSkills.filter((cs) => cs.course_id === c.id),
  }));

  const recommendedCourses = recommendCoursesForGaps(analysis.gaps, coursesWithSkills, enrolledSet)
    .filter((c) => c.relevanceScore > 0)
    .slice(0, 4);

  return res.json({
    targetJob,
    allTargetJobs: queryAll('SELECT id, title, company FROM jobs WHERE is_open = 1 ORDER BY id ASC'),
    analysis,
    recommendedCourses,
  });
});

export default router;
