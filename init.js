import fs from 'node:fs';
import path from 'node:path';
import bcrypt from 'bcryptjs';
import { getDb, queryOne, withTransaction } from '../config/db.js';
import { env } from '../config/env.js';
import { sha256Buffer } from '../services/storageService.js';

export function initializeDatabase({ seedIfEmpty = true } = {}) {
  const db = getDb();
  const schemaPath = path.join(env.schemaDir, 'sqlite_schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schemaSql);

  if (seedIfEmpty) {
    const existing = queryOne('SELECT COUNT(*) AS count FROM users');
    if (!existing || existing.count === 0) {
      seedDatabase();
    }
  }
}

export function seedDatabase({ reset = false } = {}) {
  const db = getDb();
  if (reset) {
    db.exec(`
      DELETE FROM activity_logs;
      DELETE FROM applications;
      DELETE FROM job_skills;
      DELETE FROM jobs;
      DELETE FROM certificate_verifications;
      DELETE FROM certificates;
      DELETE FROM enrollments;
      DELETE FROM course_skills;
      DELETE FROM courses;
      DELETE FROM assessment_attempts;
      DELETE FROM assessment_questions;
      DELETE FROM assessments;
      DELETE FROM user_skills;
      DELETE FROM skills;
      DELETE FROM users;
    `);
  }

  const demoPasswordHash = bcrypt.hashSync('Password123!', 10);

  withTransaction(() => {
    const insertUser = db.prepare(`
      INSERT INTO users (full_name, email, password_hash, role, headline, organization, target_role)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const learner1Id = Number(
      insertUser.run(
        'Aarav Sharma',
        'aarav@careerforge.dev',
        demoPasswordHash,
        'learner',
        'Final-Year CS Student | Aspiring Full-Stack & Cloud Engineer',
        'National Institute of Technology',
        'Full-Stack Cloud Engineer'
      ).lastInsertRowid
    );

    const learner2Id = Number(
      insertUser.run(
        'Priya Nair',
        'priya@careerforge.dev',
        demoPasswordHash,
        'learner',
        'B.Tech IT Graduate | Azure Data & BI Enthusiast',
        'State Engineering College',
        'Junior Azure Data Engineer'
      ).lastInsertRowid
    );

    const educatorId = Number(
      insertUser.run(
        'Dr. Maya Verma',
        'maya@careerforge.dev',
        demoPasswordHash,
        'educator',
        'Professor of Cloud Systems & Database Engineering',
        'CareerForge Academy',
        null
      ).lastInsertRowid
    );

    const employerId = Number(
      insertUser.run(
        'Rohan Kulkarni',
        'rohan@careerforge.dev',
        demoPasswordHash,
        'employer',
        'Engineering Talent Lead',
        'CloudScale Systems Pvt Ltd',
        null
      ).lastInsertRowid
    );

    const verifierId = Number(
      insertUser.run(
        'Ananya Iyer',
        'verifier@careerforge.dev',
        demoPasswordHash,
        'verifier',
        'Senior Credential Auditor',
        'CareerForge Trust & Verification Authority',
        null
      ).lastInsertRowid
    );

    // Skills Catalog
    const insertSkill = db.prepare(`
      INSERT INTO skills (name, category, description) VALUES (?, ?, ?)
    `);
    const skillsData = [
      ['React.js & Frontend UI', 'Web Development', 'Component architecture, hooks, state management, HTML5/CSS3'],
      ['Node.js & Express APIs', 'Backend & Systems', 'RESTful API design, middleware, async execution, Express.js'],
      ['Relational Databases & SQL', 'Databases', '3NF normalization, joins, indexes, views, triggers, transactions'],
      ['Azure Data Services (DP-900)', 'Cloud & Data', 'Azure SQL Database, Azure Blob Storage, relational vs non-relational workloads'],
      ['Cloud Security & IAM', 'Security', 'JWT auth, RBAC, bcrypt hashing, TLS/HTTPS, OWASP injection/XSS defense'],
      ['Data Structures & Algorithms', 'Computer Science', 'HashMaps, trees, graphs, sorting, complexity analysis'],
      ['Power BI & Data Analytics', 'Analytics', 'DAX, semantic models, DirectQuery dashboards, KPI reporting'],
      ['System Design & Caching', 'Architecture', 'Three-tier architecture, caching strategies, horizontal scalability'],
    ];

    const skillIds = {};
    for (const [name, cat, desc] of skillsData) {
      skillIds[name] = Number(insertSkill.run(name, cat, desc).lastInsertRowid);
    }

    // User Skills
    const insertUserSkill = db.prepare(`
      INSERT INTO user_skills (user_id, skill_id, proficiency_level, verified, source)
      VALUES (?, ?, ?, ?, ?)
    `);

    // Aarav has solid Web/Backend/DSA, gaps in Azure DP-900, Cloud Security, Power BI
    insertUserSkill.run(learner1Id, skillIds['React.js & Frontend UI'], 4, 1, 'assessment');
    insertUserSkill.run(learner1Id, skillIds['Node.js & Express APIs'], 4, 1, 'certificate');
    insertUserSkill.run(learner1Id, skillIds['Relational Databases & SQL'], 3, 1, 'assessment');
    insertUserSkill.run(learner1Id, skillIds['Data Structures & Algorithms'], 4, 0, 'self');
    insertUserSkill.run(learner1Id, skillIds['Azure Data Services (DP-900)'], 2, 0, 'self');
    insertUserSkill.run(learner1Id, skillIds['Cloud Security & IAM'], 2, 0, 'self');

    // Priya has strong Azure Data, SQL, Power BI
    insertUserSkill.run(learner2Id, skillIds['Relational Databases & SQL'], 5, 1, 'assessment');
    insertUserSkill.run(learner2Id, skillIds['Azure Data Services (DP-900)'], 4, 1, 'certificate');
    insertUserSkill.run(learner2Id, skillIds['Power BI & Data Analytics'], 4, 1, 'assessment');
    insertUserSkill.run(learner2Id, skillIds['Cloud Security & IAM'], 3, 0, 'course');
    insertUserSkill.run(learner2Id, skillIds['Node.js & Express APIs'], 2, 0, 'self');

    // Assessments + Questions
    const insertAssessment = db.prepare(`
      INSERT INTO assessments (skill_id, title, difficulty, pass_score, created_by)
      VALUES (?, ?, ?, ?, ?)
    `);
    const insertQuestion = db.prepare(`
      INSERT INTO assessment_questions (assessment_id, question_text, options_json, correct_index, weight)
      VALUES (?, ?, ?, ?, ?)
    `);

    const assessmentsSeed = [
      {
        skill: 'Azure Data Services (DP-900)',
        title: 'Microsoft Azure Data Fundamentals (DP-900) Readiness Check',
        difficulty: 'Intermediate',
        passScore: 60,
        questions: [
          [
            'Which Azure service is best suited for storing unstructured certificate PDFs and images with REST/SAS access?',
            ['Azure Blob Storage', 'Azure SQL Database', 'Azure Table Storage', 'Azure Analysis Services'],
            0,
          ],
          [
            'Which characteristic defines a relational database workload in Azure SQL Database?',
            ['Schema-less JSON documents only', 'Normalized tables with primary/foreign keys and ACID transactions', 'Key-value cache without joins', 'Append-only log streaming'],
            1,
          ],
          [
            'In Power BI, which mode queries live Azure SQL tables without importing a static snapshot?',
            ['Import Cache', 'DirectQuery', 'CSV Snapshot', 'Static Embed'],
            1,
          ],
          [
            'Which Azure role ensures least-privilege access to Blob containers?',
            ['Storage Blob Data Reader', 'Global Subscription Owner', 'Network Contributor', 'Billing Reader'],
            0,
          ],
        ],
      },
      {
        skill: 'Relational Databases & SQL',
        title: 'RDBMS Normalization, Indexing & Transactions Assessment',
        difficulty: 'Intermediate',
        passScore: 60,
        questions: [
          [
            'What does Third Normal Form (3NF) eliminate?',
            ['Primary keys', 'Transitive functional dependencies', 'Foreign key constraints', 'SQL views'],
            1,
          ],
          [
            'Why do database triggers and stored procedures improve verification workflows?',
            ['They replace HTTPS encryption', 'They enforce atomic rules and automatic audit trails inside the database', 'They disable foreign keys', 'They remove the need for indexes'],
            1,
          ],
          [
            'Which SQL object provides a reusable virtual table for Power BI or API reporting without duplicating data?',
            ['VIEW', 'TRIGGER', 'ROLLBACK', 'TRUNCATE'],
            0,
          ],
        ],
      },
      {
        skill: 'Cloud Security & IAM',
        title: 'Application & Cloud Security Fundamentals',
        difficulty: 'Intermediate',
        passScore: 60,
        questions: [
          [
            'Why should passwords be hashed with bcrypt instead of plain SHA-256?',
            ['bcrypt is reversible', 'bcrypt includes adaptive cost factor and per-user salt to resist brute-force attacks', 'bcrypt compresses JWT tokens', 'SHA-256 cannot run in Node.js'],
            1,
          ],
          [
            'What is the primary defense against SQL Injection in Node.js database calls?',
            ['String concatenation with trim()', 'Parameterized queries / prepared statements', 'Client-side CSS hiding', 'Disabling CORS'],
            1,
          ],
          [
            'What does Role-Based Access Control (RBAC) enforce on an API endpoint?',
            ['Only users with permitted roles (e.g. verifier, employer) can invoke privileged actions', 'Every logged-in user shares admin permissions', 'Tokens never expire', 'Passwords are stored in localStorage'],
            0,
          ],
        ],
      },
      {
        skill: 'React.js & Frontend UI',
        title: 'Modern React & Three-Tier Frontend Proficiency',
        difficulty: 'Intermediate',
        passScore: 60,
        questions: [
          [
            'Which React hook manages side effects such as fetching REST API data on mount?',
            ['useMemo', 'useEffect', 'useId', 'useDebugValue'],
            1,
          ],
          [
            'How should JWT Bearer tokens be sent from React to a protected Express API?',
            ['In the URL query string on every GET', 'In the Authorization: Bearer <token> HTTP header', 'Inside HTML meta tags', 'As a CSS variable'],
            1,
          ],
          [
            'What prevents XSS when rendering user-entered strings in React JSX?',
            ['React escapes text nodes by default and backend sanitization strips script tags', 'Using eval() on JSON responses', 'Disabling Content-Security-Policy', 'Storing HTML in SQL views'],
            0,
          ],
        ],
      },
      {
        skill: 'System Design & Caching',
        title: 'Scalable Three-Tier Architecture & Caching',
        difficulty: 'Advanced',
        passScore: 60,
        questions: [
          [
            'Which caching pattern checks the cache first, queries the RDBMS on a miss, and populates the cache with a TTL?',
            ['Write-behind logging', 'Cache-aside (lazy loading)', 'Round-robin DNS', 'Database sharding'],
            1,
          ],
          [
            'When a course or certificate changes in the database, what should the API do to cached analytics?',
            ['Wait 24 hours always', 'Invalidate affected cache keys/prefixes immediately', 'Restart the React dev server', 'Drop the database index'],
            1,
          ],
          [
            'In a three-tier architecture, which tier enforces RBAC and business validation?',
            ['Presentation tier only', 'Application / API tier', 'Browser localStorage', 'Power BI desktop'],
            1,
          ],
        ],
      },
    ];

    for (const a of assessmentsSeed) {
      const aId = Number(
        insertAssessment.run(skillIds[a.skill], a.title, a.difficulty, a.passScore, educatorId).lastInsertRowid
      );
      for (const [qText, opts, correctIdx] of a.questions) {
        insertQuestion.run(aId, qText, JSON.stringify(opts), correctIdx, 1);
      }
    }

    // Seed one historical assessment attempt
    db.prepare(`
      INSERT INTO assessment_attempts (assessment_id, user_id, score, awarded_level, passed)
      VALUES (?, ?, ?, ?, ?)
    `).run(2, learner1Id, 100, 5, 1);

    // Courses & Course Skills
    const insertCourse = db.prepare(`
      INSERT INTO courses (educator_id, title, provider, description, difficulty, duration_hours, resource_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insertCourseSkill = db.prepare(`
      INSERT INTO course_skills (course_id, skill_id, target_level) VALUES (?, ?, ?)
    `);

    const c1 = Number(
      insertCourse.run(
        educatorId,
        'Azure Data Services (DP-900) Mastery Lab',
        'CareerForge Academy',
        'Hands-on pathway covering Azure SQL Database, Blob Storage containers, SAS policies, and relational vs non-relational workloads.',
        'Intermediate',
        14,
        'https://learn.microsoft.com/en-us/credentials/certifications/azure-data-fundamentals/'
      ).lastInsertRowid
    );
    insertCourseSkill.run(c1, skillIds['Azure Data Services (DP-900)'], 4);
    insertCourseSkill.run(c1, skillIds['Relational Databases & SQL'], 4);

    const c2 = Number(
      insertCourse.run(
        educatorId,
        'Cloud Security, JWT & OWASP Defense in Node.js',
        'CareerForge Security Lab',
        'Implement bcrypt hashing, JWT RBAC, Helmet headers, parameterized SQL, XSS sanitization, and Azure SQL firewall rules.',
        'Intermediate',
        10,
        'https://owasp.org/www-project-top-ten/'
      ).lastInsertRowid
    );
    insertCourseSkill.run(c2, skillIds['Cloud Security & IAM'], 4);
    insertCourseSkill.run(c2, skillIds['Node.js & Express APIs'], 4);

    const c3 = Number(
      insertCourse.run(
        educatorId,
        'Three-Tier System Design & API Caching Patterns',
        'CareerForge Architecture Track',
        'Design REST APIs with TTL cache-aside strategies, database indexing, and horizontal scaling patterns.',
        'Advanced',
        12,
        'https://learn.microsoft.com/en-us/azure/architecture/'
      ).lastInsertRowid
    );
    insertCourseSkill.run(c3, skillIds['System Design & Caching'], 4);
    insertCourseSkill.run(c3, skillIds['Node.js & Express APIs'], 5);

    const c4 = Number(
      insertCourse.run(
        educatorId,
        'Power BI Analytics for Azure SQL Workloads',
        'CareerForge Data Studio',
        'Build DirectQuery semantic models, skill gap heatmaps, and executive readiness dashboards in Microsoft Power BI.',
        'Beginner',
        8,
        'https://learn.microsoft.com/en-us/power-bi/'
      ).lastInsertRowid
    );
    insertCourseSkill.run(c4, skillIds['Power BI & Data Analytics'], 4);
    insertCourseSkill.run(c4, skillIds['Azure Data Services (DP-900)'], 3);

    const c5 = Number(
      insertCourse.run(
        educatorId,
        'Production React.js & Accessible Design Systems',
        'CareerForge Frontend Guild',
        'Build responsive multi-role dashboards using React hooks, REST API clients, and modern CSS architecture.',
        'Intermediate',
        11,
        'https://react.dev/'
      ).lastInsertRowid
    );
    insertCourseSkill.run(c5, skillIds['React.js & Frontend UI'], 5);

    // Enrollments
    db.prepare(`
      INSERT INTO enrollments (user_id, course_id, progress_percent, status, completed_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(learner1Id, c5, 100, 'completed', new Date().toISOString());

    db.prepare(`
      INSERT INTO enrollments (user_id, course_id, progress_percent, status)
      VALUES (?, ?, ?, ?)
    `).run(learner1Id, c1, 45, 'in_progress');

    db.prepare(`
      INSERT INTO enrollments (user_id, course_id, progress_percent, status, completed_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(learner2Id, c4, 100, 'completed', new Date().toISOString());

    // Certificates + Sample Files on disk
    fs.mkdirSync(env.uploadDir, { recursive: true });
    const insertCert = db.prepare(`
      INSERT INTO certificates (user_id, skill_id, title, issuer, issued_date, verification_code, file_name, blob_url, file_hash_sha256, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertVerification = db.prepare(`
      INSERT INTO certificate_verifications (certificate_id, verifier_id, decision, notes)
      VALUES (?, ?, ?, ?)
    `);

    const makeSampleFile = (filename, content) => {
      const buf = Buffer.from(content, 'utf8');
      const hash = sha256Buffer(buf);
      fs.writeFileSync(path.join(env.uploadDir, filename), buf);
      return { hash, url: `/api/certificates/files/${filename}` };
    };

    const f1 = makeSampleFile(
      'seed-node-cert.txt',
      'CareerForge Verified Credential\nRecipient: Aarav Sharma\nTitle: Backend Engineering with Node.js & Express\nIssuer: Linux Foundation / OpenJS\nCode: CF-CERT-2026-8F4A19C2'
    );
    const cert1Id = Number(
      insertCert.run(
        learner1Id,
        skillIds['Node.js & Express APIs'],
        'Backend Engineering with Node.js & Express',
        'OpenJS Foundation',
        '2026-06-14',
        'CF-CERT-2026-8F4A19C2',
        'seed-node-cert.txt',
        f1.url,
        f1.hash,
        'VERIFIED'
      ).lastInsertRowid
    );
    insertVerification.run(cert1Id, verifierId, 'VERIFIED', 'SHA-256 checksum & issuer registry validated.');

    const f2 = makeSampleFile(
      'seed-dp900-pending.txt',
      'CareerForge Pending Credential\nRecipient: Aarav Sharma\nTitle: Microsoft Certified: Azure Data Fundamentals (DP-900)\nIssuer: Microsoft\nCode: CF-CERT-2026-3D9E71B0'
    );
    const cert2Id = Number(
      insertCert.run(
        learner1Id,
        skillIds['Azure Data Services (DP-900)'],
        'Microsoft Certified: Azure Data Fundamentals (DP-900)',
        'Microsoft',
        '2026-09-20',
        'CF-CERT-2026-3D9E71B0',
        'seed-dp900-pending.txt',
        f2.url,
        f2.hash,
        'PENDING'
      ).lastInsertRowid
    );
    insertVerification.run(cert2Id, null, 'PENDING', 'Queued for verifier audit.');

    const f3 = makeSampleFile(
      'seed-priya-dp900.txt',
      'CareerForge Verified Credential\nRecipient: Priya Nair\nTitle: Microsoft Certified: Azure Data Fundamentals (DP-900)\nIssuer: Microsoft\nCode: CF-CERT-2026-A12C44E8'
    );
    const cert3Id = Number(
      insertCert.run(
        learner2Id,
        skillIds['Azure Data Services (DP-900)'],
        'Microsoft Certified: Azure Data Fundamentals (DP-900)',
        'Microsoft',
        '2026-08-05',
        'CF-CERT-2026-A12C44E8',
        'seed-priya-dp900.txt',
        f3.url,
        f3.hash,
        'VERIFIED'
      ).lastInsertRowid
    );
    insertVerification.run(cert3Id, verifierId, 'VERIFIED', 'Microsoft transcript ID verified.');

    // Jobs & Job Skills
    const insertJob = db.prepare(`
      INSERT INTO jobs (employer_id, title, company, location, employment_type, salary_range, description, is_open)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)
    `);
    const insertJobSkill = db.prepare(`
      INSERT INTO job_skills (job_id, skill_id, required_level, is_mandatory) VALUES (?, ?, ?, ?)
    `);

    const j1 = Number(
      insertJob.run(
        employerId,
        'Full-Stack Cloud Engineer',
        'CloudScale Systems Pvt Ltd',
        'Bengaluru / Hybrid',
        'Full-time',
        '₹10L – ₹15L / yr',
        'Build three-tier React and Node.js applications backed by Azure SQL Database, Blob Storage, and secure RBAC APIs.'
      ).lastInsertRowid
    );
    insertJobSkill.run(j1, skillIds['React.js & Frontend UI'], 4, 1);
    insertJobSkill.run(j1, skillIds['Node.js & Express APIs'], 4, 1);
    insertJobSkill.run(j1, skillIds['Relational Databases & SQL'], 4, 1);
    insertJobSkill.run(j1, skillIds['Azure Data Services (DP-900)'], 3, 1);
    insertJobSkill.run(j1, skillIds['Cloud Security & IAM'], 3, 1);
    insertJobSkill.run(j1, skillIds['System Design & Caching'], 3, 0);

    const j2 = Number(
      insertJob.run(
        employerId,
        'Junior Azure Data & BI Analyst',
        'CloudScale Systems Pvt Ltd',
        'Hyderabad / Remote',
        'Full-time',
        '₹8L – ₹12L / yr',
        'Design normalized Azure SQL views, monitor DP-900 data pipelines, and deliver executive Power BI analytics dashboards.'
      ).lastInsertRowid
    );
    insertJobSkill.run(j2, skillIds['Relational Databases & SQL'], 4, 1);
    insertJobSkill.run(j2, skillIds['Azure Data Services (DP-900)'], 4, 1);
    insertJobSkill.run(j2, skillIds['Power BI & Data Analytics'], 4, 1);
    insertJobSkill.run(j2, skillIds['Cloud Security & IAM'], 2, 0);

    const j3 = Number(
      insertJob.run(
        employerId,
        'Backend API & Security Developer',
        'FinTrust Digital',
        'Pune / Hybrid',
        'Full-time',
        '₹9L – ₹14L / yr',
        'Architect low-latency Express.js REST services with JWT RBAC, parameterized SQL, caching, and audit logging.'
      ).lastInsertRowid
    );
    insertJobSkill.run(j3, skillIds['Node.js & Express APIs'], 4, 1);
    insertJobSkill.run(j3, skillIds['Cloud Security & IAM'], 4, 1);
    insertJobSkill.run(j3, skillIds['Relational Databases & SQL'], 4, 1);
    insertJobSkill.run(j3, skillIds['System Design & Caching'], 3, 1);

    const j4 = Number(
      insertJob.run(
        employerId,
        'Associate Software Engineer (DSA & Web)',
        'ApexTech Labs',
        'Remote',
        'Internship / FTE',
        '₹7L – ₹10L / yr',
        'Collaborate across React UI components and core algorithmic matching services with strong CS fundamentals.'
      ).lastInsertRowid
    );
    insertJobSkill.run(j4, skillIds['Data Structures & Algorithms'], 4, 1);
    insertJobSkill.run(j4, skillIds['React.js & Frontend UI'], 3, 1);
    insertJobSkill.run(j4, skillIds['Node.js & Express APIs'], 3, 0);

    // Seed Applications
    db.prepare(`
      INSERT INTO applications (job_id, user_id, match_score, status, cover_note)
      VALUES (?, ?, ?, ?, ?)
    `).run(j1, learner1Id, 76, 'SHORTLISTED', 'Built full-stack React/Express projects and currently completing DP-900 lab.');

    db.prepare(`
      INSERT INTO applications (job_id, user_id, match_score, status, cover_note)
      VALUES (?, ?, ?, ?, ?)
    `).run(j2, learner2Id, 96, 'INTERVIEW', 'Microsoft DP-900 certified with hands-on Power BI and Azure SQL modeling.');

    // Activity Logs
    const insertLog = db.prepare(`
      INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details, ip_address)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertLog.run(learner1Id, 'ASSESSMENT_COMPLETED', 'assessment', 2, 'Scored 100% on RDBMS assessment', '127.0.0.1');
    insertLog.run(verifierId, 'CERTIFICATE_VERIFIED', 'certificate', cert1Id, 'Verified CF-CERT-2026-8F4A19C2', '127.0.0.1');
    insertLog.run(employerId, 'JOB_PUBLISHED', 'job', j1, 'Published Full-Stack Cloud Engineer role', '127.0.0.1');
  });
}
