import express from 'express';
import { queryAll, queryOne, withTransaction } from '../config/db.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';
import { logActivity } from '../middleware/auditLogger.js';
import { cache } from '../utils/cache.js';

const router = express.Router();

router.get('/', authenticate, (req, res) => {
  const assessments = queryAll(`
    SELECT a.*, s.name AS skill_name, s.category,
           (SELECT COUNT(*) FROM assessment_questions q WHERE q.assessment_id = a.id) AS question_count
    FROM assessments a
    JOIN skills s ON s.id = a.skill_id
    ORDER BY a.id ASC
  `);

  const myAttempts = queryAll(
    `SELECT assessment_id, MAX(score) AS best_score, MAX(passed) AS ever_passed, COUNT(*) AS attempts_count
     FROM assessment_attempts
     WHERE user_id = ?
     GROUP BY assessment_id`,
    req.user.id
  );
  const attemptMap = new Map(myAttempts.map((m) => [m.assessment_id, m]));

  const enriched = assessments.map((a) => ({
    ...a,
    userProgress: attemptMap.get(a.id) || null,
  }));

  res.json({ assessments: enriched });
});

router.get('/:id', authenticate, (req, res) => {
  const assessmentId = Number(req.params.id);
  const assessment = queryOne(
    `SELECT a.*, s.name AS skill_name, s.category
     FROM assessments a
     JOIN skills s ON s.id = a.skill_id
     WHERE a.id = ?`,
    assessmentId
  );
  if (!assessment) {
    return res.status(404).json({ error: 'Assessment not found.' });
  }

  // Never expose correct_index to the client
  const questions = queryAll(
    `SELECT id, question_text, options_json, weight
     FROM assessment_questions
     WHERE assessment_id = ?
     ORDER BY id ASC`,
    assessmentId
  ).map((q) => ({
    id: q.id,
    question_text: q.question_text,
    options: JSON.parse(q.options_json),
    weight: q.weight,
  }));

  return res.json({ assessment, questions });
});

router.post('/:id/submit', authenticate, authorizeRoles('learner'), (req, res) => {
  const assessmentId = Number(req.params.id);
  const answers = req.body?.answers;
  if (!answers || typeof answers !== 'object') {
    return res.status(400).json({ error: 'Answers object is required.' });
  }

  const assessment = queryOne('SELECT * FROM assessments WHERE id = ?', assessmentId);
  if (!assessment) {
    return res.status(404).json({ error: 'Assessment not found.' });
  }

  const questions = queryAll(
    'SELECT * FROM assessment_questions WHERE assessment_id = ? ORDER BY id ASC',
    assessmentId
  );
  if (questions.length === 0) {
    return res.status(400).json({ error: 'Assessment has no questions.' });
  }

  let totalWeight = 0;
  let earnedWeight = 0;
  const breakdown = [];

  for (const q of questions) {
    totalWeight += q.weight;
    const selected = Number(answers[q.id]);
    const isCorrect = selected === q.correct_index;
    if (isCorrect) earnedWeight += q.weight;
    breakdown.push({
      questionId: q.id,
      isCorrect,
      selectedIndex: Number.isFinite(selected) ? selected : null,
      correctIndex: q.correct_index,
    });
  }

  const score = Math.round((earnedWeight / totalWeight) * 100);
  const passed = score >= assessment.pass_score ? 1 : 0;
  let awardedLevel = 1;
  if (score >= 90) awardedLevel = 5;
  else if (score >= 75) awardedLevel = 4;
  else if (score >= 60) awardedLevel = 3;
  else if (score >= 40) awardedLevel = 2;

  withTransaction((db) => {
    db.prepare(
      `INSERT INTO assessment_attempts (assessment_id, user_id, score, awarded_level, passed)
       VALUES (?, ?, ?, ?, ?)`
    ).run(assessmentId, req.user.id, score, awardedLevel, passed);

    const existingSkill = db
      .prepare('SELECT * FROM user_skills WHERE user_id = ? AND skill_id = ?')
      .get(req.user.id, assessment.skill_id);

    if (existingSkill) {
      const nextLevel = Math.max(existingSkill.proficiency_level, awardedLevel);
      const nextVerified = passed ? 1 : existingSkill.verified;
      const nextSource = passed ? 'assessment' : existingSkill.source;
      db.prepare(
        `UPDATE user_skills
         SET proficiency_level = ?, verified = ?, source = ?, last_assessed_at = datetime('now')
         WHERE user_id = ? AND skill_id = ?`
      ).run(nextLevel, nextVerified, nextSource, req.user.id, assessment.skill_id);
    } else {
      db.prepare(
        `INSERT INTO user_skills (user_id, skill_id, proficiency_level, verified, source)
         VALUES (?, ?, ?, ?, 'assessment')`
      ).run(req.user.id, assessment.skill_id, awardedLevel, passed);
    }
  });

  cache.invalidatePrefix('analytics:');
  logActivity({
    userId: req.user.id,
    action: 'ASSESSMENT_SUBMITTED',
    entityType: 'assessment',
    entityId: assessmentId,
    details: `Score: ${score}% (Awarded level ${awardedLevel}, passed=${Boolean(passed)})`,
    ipAddress: req.ip,
  });

  return res.json({
    score,
    passed: Boolean(passed),
    awardedLevel,
    passScore: assessment.pass_score,
    breakdown,
  });
});

export default router;
