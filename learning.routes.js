import express from 'express';
import { queryAll, queryOne, run, withTransaction } from '../config/db.js';
import { authenticate, authorizeRoles, optionalAuth } from '../middleware/auth.js';
import { clampInt, requireFields, sanitizeText } from '../middleware/validate.js';
import { logActivity } from '../middleware/auditLogger.js';
import { cache } from '../utils/cache.js';
import { buildUserSkillMap, computeJobMatch, recommendCoursesForGaps } from '../services/matchingService.js';

const router = express.Router();

router.get('/courses', optionalAuth, (req, res) => {
  let courses = cache.get('courses:all');
  if (!courses) {
    const rawCourses = queryAll(`
      SELECT c.*, u.full_name AS educator_name
      FROM courses c
      JOIN users u ON u.id = c.educator_id
      ORDER BY c.id DESC
    `);
    const courseSkills = queryAll(`
      SELECT cs.*, s.name AS skill_name, s.category
      FROM course_skills cs
      JOIN skills s ON s.id = cs.skill_id
    `);
    courses = rawCourses.map((c) => ({
      ...c,
      skills: courseSkills.filter((cs) => cs.course_id === c.id),
    }));
    cache.set('courses:all', courses, 45_000);
  }

  if (!req.user) {
    return res.json({ courses });
  }

  const enrollments = queryAll('SELECT * FROM enrollments WHERE user_id = ?', req.user.id);
  const enrollmentMap = new Map(enrollments.map((e) => [e.course_id, e]));

  if (req.user.role === 'learner') {
    const userSkills = queryAll('SELECT * FROM user_skills WHERE user_id = ?', req.user.id);
    const skillMap = buildUserSkillMap(userSkills);
    const allJobReqs = queryAll(`
      SELECT js.*, s.name AS skill_name, s.category
      FROM job_skills js
      JOIN jobs j ON j.id = js.job_id AND j.is_open = 1
      JOIN skills s ON s.id = js.skill_id
    `);
    const match = computeJobMatch(skillMap, allJobReqs);
    const enrolledIds = new Set(enrollments.map((e) => e.course_id));
    const personalized = recommendCoursesForGaps(match.gaps, courses, enrolledIds).map((c) => ({
      ...c,
      enrollment: enrollmentMap.get(c.id) || null,
    }));
    return res.json({ courses: personalized, enrollments });
  }

  const withEnrollments = courses.map((c) => ({
    ...c,
    enrollment: enrollmentMap.get(c.id) || null,
  }));
  return res.json({ courses: withEnrollments, enrollments });
});

router.post('/courses', authenticate, authorizeRoles('educator'), (req, res) => {
  const missing = requireFields(req.body, ['title', 'description', 'difficulty', 'duration_hours']);
  if (missing.length > 0) {
    return res.status(400).json({ error: `Missing fields: ${missing.join(', ')}` });
  }

  const title = sanitizeText(req.body.title, 180);
  const provider = sanitizeText(req.body.provider || 'CareerForge Educator', 120);
  const description = sanitizeText(req.body.description, 1000);
  const difficulty = ['Beginner', 'Intermediate', 'Advanced'].includes(req.body.difficulty)
    ? req.body.difficulty
    : 'Intermediate';
  const durationHours = clampInt(req.body.duration_hours, 1, 500, 8);
  const resourceUrl = sanitizeText(req.body.resource_url || '', 500) || null;
  const skillMappings = Array.isArray(req.body.skills) ? req.body.skills : [];

  const createdId = withTransaction((db) => {
    const courseRes = db
      .prepare(
        `INSERT INTO courses (educator_id, title, provider, description, difficulty, duration_hours, resource_url)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(req.user.id, title, provider, description, difficulty, durationHours, resourceUrl);
    const courseId = Number(courseRes.lastInsertRowid);

    const insertMapping = db.prepare(
      'INSERT OR REPLACE INTO course_skills (course_id, skill_id, target_level) VALUES (?, ?, ?)'
    );
    for (const s of skillMappings) {
      if (s.skill_id) {
        insertMapping.run(courseId, Number(s.skill_id), clampInt(s.target_level, 1, 5, 3));
      }
    }
    return courseId;
  });

  cache.invalidatePrefix('courses:');
  cache.invalidatePrefix('analytics:');
  logActivity({
    userId: req.user.id,
    action: 'COURSE_CREATED',
    entityType: 'course',
    entityId: createdId,
    details: `Published course "${title}"`,
    ipAddress: req.ip,
  });

  const created = queryOne('SELECT * FROM courses WHERE id = ?', createdId);
  return res.status(201).json({ course: created });
});

router.post('/enroll', authenticate, authorizeRoles('learner'), (req, res) => {
  const courseId = Number(req.body?.course_id);
  if (!courseId) return res.status(400).json({ error: 'course_id is required.' });

  const course = queryOne('SELECT * FROM courses WHERE id = ?', courseId);
  if (!course) return res.status(404).json({ error: 'Course not found.' });

  const existing = queryOne(
    'SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?',
    req.user.id,
    courseId
  );
  if (existing) return res.json({ enrollment: existing });

  run(
    `INSERT INTO enrollments (user_id, course_id, progress_percent, status)
     VALUES (?, ?, 15, 'in_progress')`,
    req.user.id,
    courseId
  );

  cache.invalidatePrefix('analytics:');
  const enrollment = queryOne(
    'SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?',
    req.user.id,
    courseId
  );
  return res.status(201).json({ enrollment });
});

router.post('/courses/:id/complete', authenticate, authorizeRoles('learner'), (req, res) => {
  const courseId = Number(req.params.id);
  const course = queryOne('SELECT * FROM courses WHERE id = ?', courseId);
  if (!course) return res.status(404).json({ error: 'Course not found.' });

  withTransaction((db) => {
    const existing = db
      .prepare('SELECT * FROM enrollments WHERE user_id = ? AND course_id = ?')
      .get(req.user.id, courseId);

    if (existing) {
      db.prepare(
        `UPDATE enrollments
         SET progress_percent = 100, status = 'completed', completed_at = datetime('now')
         WHERE user_id = ? AND course_id = ?`
      ).run(req.user.id, courseId);
    } else {
      db.prepare(
        `INSERT INTO enrollments (user_id, course_id, progress_percent, status, completed_at)
         VALUES (?, ?, 100, 'completed', datetime('now'))`
      ).run(req.user.id, courseId);
    }

    const mappedSkills = db
      .prepare('SELECT skill_id, target_level FROM course_skills WHERE course_id = ?')
      .all(courseId);

    for (const ms of mappedSkills) {
      const userSkill = db
        .prepare('SELECT * FROM user_skills WHERE user_id = ? AND skill_id = ?')
        .get(req.user.id, ms.skill_id);
      if (userSkill) {
        const nextLevel = Math.max(userSkill.proficiency_level, ms.target_level);
        db.prepare(
          `UPDATE user_skills
           SET proficiency_level = ?,
               source = CASE WHEN verified = 1 THEN source ELSE 'course' END,
               last_assessed_at = datetime('now')
           WHERE user_id = ? AND skill_id = ?`
        ).run(nextLevel, req.user.id, ms.skill_id);
      } else {
        db.prepare(
          `INSERT INTO user_skills (user_id, skill_id, proficiency_level, verified, source)
           VALUES (?, ?, ?, 0, 'course')`
        ).run(req.user.id, ms.skill_id, ms.target_level);
      }
    }
  });

  cache.invalidatePrefix('analytics:');
  logActivity({
    userId: req.user.id,
    action: 'COURSE_COMPLETED',
    entityType: 'course',
    entityId: courseId,
    details: `Completed "${course.title}" and updated mapped skills`,
    ipAddress: req.ip,
  });

  return res.json({ message: 'Course completed and skill proficiencies updated.' });
});

export default router;
