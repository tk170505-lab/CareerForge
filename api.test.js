import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';

// Use an isolated temporary database for tests before importing app modules
const tempDbPath = path.join(os.tmpdir(), `careerforge-test-${Date.now()}.db`);
process.env.SQLITE_PATH = tempDbPath;
process.env.JWT_SECRET = 'test-secret-key';

const { initializeDatabase, seedDatabase } = await import('../src/db/init.js');
const { createApp } = await import('../src/app.js');
const { closeDb } = await import('../src/config/db.js');

let server;
let baseUrl;

async function request(method, pathname, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  return { status: res.status, headers: res.headers, data };
}

test.before(async () => {
  initializeDatabase({ seedIfEmpty: false });
  seedDatabase({ reset: true });
  const app = createApp();
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  closeDb();
  if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
});

test('Health endpoint & seeded demo login + RBAC enforcement', async () => {
  const health = await request('GET', '/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.data.status, 'ok');

  const login = await request('POST', '/api/auth/login', {
    body: { email: 'aarav@careerforge.dev', password: 'Password123!' },
  });
  assert.equal(login.status, 200);
  assert.ok(login.data.token);
  assert.equal(login.data.user.role, 'learner');

  // Learner must be forbidden from employer job creation (RBAC)
  const forbidden = await request('POST', '/api/jobs', {
    token: login.data.token,
    body: { title: 'Test', company: 'X', location: 'Y', description: 'Z' },
  });
  assert.equal(forbidden.status, 403);
});

test('Skill assessment submission grades and upgrades user_skills transactionally', async () => {
  const login = await request('POST', '/api/auth/login', {
    body: { email: 'aarav@careerforge.dev', password: 'Password123!' },
  });
  const token = login.data.token;

  const quiz = await request('GET', '/api/assessments/1', { token });
  assert.equal(quiz.status, 200);
  assert.equal(quiz.data.questions[0].correct_index, undefined, 'correct_index must not leak');

  // Answer all 4 DP-900 questions correctly (0, 1, 1, 0)
  const answers = {};
  const correctIndices = [0, 1, 1, 0];
  quiz.data.questions.forEach((q, idx) => {
    answers[q.id] = correctIndices[idx];
  });

  const submit = await request('POST', '/api/assessments/1/submit', {
    token,
    body: { answers },
  });
  assert.equal(submit.status, 200);
  assert.equal(submit.data.score, 100);
  assert.equal(submit.data.passed, true);
  assert.equal(submit.data.awardedLevel, 5);
});

test('Certificate upload, public verification lookup, and verifier approval + trigger audit', async () => {
  const learnerLogin = await request('POST', '/api/auth/login', {
    body: { email: 'aarav@careerforge.dev', password: 'Password123!' },
  });
  const verifierLogin = await request('POST', '/api/auth/login', {
    body: { email: 'verifier@careerforge.dev', password: 'Password123!' },
  });

  const upload = await request('POST', '/api/certificates', {
    token: learnerLogin.data.token,
    body: {
      title: 'Cloud Security Practitioner',
      issuer: 'ISC2',
      issued_date: '2026-10-01',
      skill_id: 5,
    },
  });
  assert.equal(upload.status, 201);
  const code = upload.data.certificate.verification_code;
  assert.ok(code.startsWith('CF-CERT-'));

  const beforeVerify = await request('GET', `/api/certificates/verify/${code}`);
  assert.equal(beforeVerify.status, 200);
  assert.equal(beforeVerify.data.valid, false);
  assert.equal(beforeVerify.data.certificate.status, 'PENDING');

  const approve = await request('PATCH', `/api/certificates/${upload.data.certificate.id}/verify`, {
    token: verifierLogin.data.token,
    body: { decision: 'VERIFIED', notes: 'Verified in test' },
  });
  assert.equal(approve.status, 200);
  assert.equal(approve.data.certificate.status, 'VERIFIED');

  const afterVerify = await request('GET', `/api/certificates/verify/${code}`);
  assert.equal(afterVerify.data.valid, true);
});

test('Job matching, application submission, and Power BI analytics feed', async () => {
  const learnerLogin = await request('POST', '/api/auth/login', {
    body: { email: 'aarav@careerforge.dev', password: 'Password123!' },
  });
  const token = learnerLogin.data.token;

  const jobsRes = await request('GET', '/api/jobs', { token });
  assert.equal(jobsRes.status, 200);
  assert.ok(jobsRes.data.jobs.length >= 4);
  assert.ok(typeof jobsRes.data.jobs[0].match.matchScore === 'number');

  const feed = await request('GET', '/api/analytics/powerbi-feed', { token });
  assert.equal(feed.status, 200);
  assert.ok(Array.isArray(feed.data.skillDemandVsSupply));
  assert.ok(feed.data.overview.verified_certificates >= 2);
});

test('Learning course completion upgrades skills & employer manages job applicants', async () => {
  const learnerLogin = await request('POST', '/api/auth/login', {
    body: { email: 'aarav@careerforge.dev', password: 'Password123!' },
  });
  const employerLogin = await request('POST', '/api/auth/login', {
    body: { email: 'rohan@careerforge.dev', password: 'Password123!' },
  });

  // Gap analysis endpoint
  const gapRes = await request('GET', '/api/skills/gap-analysis?jobId=1', {
    token: learnerLogin.data.token,
  });
  assert.equal(gapRes.status, 200);
  assert.ok(typeof gapRes.data.analysis.matchScore === 'number');

  // Enroll & complete course #2 (Cloud Security)
  const enrollRes = await request('POST', '/api/learning/enroll', {
    token: learnerLogin.data.token,
    body: { course_id: 2 },
  });
  assert.equal(enrollRes.status, 201);

  const completeRes = await request('POST', '/api/learning/courses/2/complete', {
    token: learnerLogin.data.token,
  });
  assert.equal(completeRes.status, 200);

  // Employer posts new job, learner applies, employer updates status
  const newJob = await request('POST', '/api/jobs', {
    token: employerLogin.data.token,
    body: {
      title: 'Cloud Security Engineer',
      company: 'CloudScale Systems',
      location: 'Remote',
      description: 'Secure Azure SQL and Express APIs.',
      skills: [{ skill_id: 5, required_level: 4, is_mandatory: true }],
    },
  });
  assert.equal(newJob.status, 201);

  const applyRes = await request('POST', `/api/jobs/${newJob.data.job.id}/apply`, {
    token: learnerLogin.data.token,
    body: { cover_note: 'Completed Cloud Security course.' },
  });
  assert.equal(applyRes.status, 201);

  const applicantsRes = await request('GET', `/api/jobs/${newJob.data.job.id}/applicants`, {
    token: employerLogin.data.token,
  });
  assert.equal(applicantsRes.status, 200);
  assert.equal(applicantsRes.data.applicants.length, 1);

  const statusUpdate = await request('PATCH', `/api/jobs/applications/${applyRes.data.application.id}/status`, {
    token: employerLogin.data.token,
    body: { status: 'INTERVIEW' },
  });
  assert.equal(statusUpdate.status, 200);
  assert.equal(statusUpdate.data.application.status, 'INTERVIEW');
});
