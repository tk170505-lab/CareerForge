-- ============================================================================
-- CareerForge — SQLite Local RDBMS Schema (Mirrors Azure SQL T-SQL Schema)
-- Includes 3NF tables, PK/FK constraints, Indexes, Views, and Triggers.
-- ============================================================================

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name       TEXT NOT NULL,
    email           TEXT NOT NULL UNIQUE,
    password_hash   TEXT NOT NULL,
    role            TEXT NOT NULL CHECK (role IN ('learner', 'educator', 'employer', 'verifier')),
    headline        TEXT,
    organization    TEXT,
    target_role     TEXT,
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_users_role ON users(role);

CREATE TABLE IF NOT EXISTS skills (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL UNIQUE,
    category        TEXT NOT NULL,
    description     TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_skills_category ON skills(category);

CREATE TABLE IF NOT EXISTS user_skills (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_id          INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    proficiency_level INTEGER NOT NULL CHECK (proficiency_level BETWEEN 1 AND 5),
    verified          INTEGER NOT NULL DEFAULT 0,
    source            TEXT NOT NULL DEFAULT 'self' CHECK (source IN ('self', 'assessment', 'course', 'certificate')),
    last_assessed_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, skill_id)
);
CREATE INDEX IF NOT EXISTS ix_user_skills_user ON user_skills(user_id);

CREATE TABLE IF NOT EXISTS assessments (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    skill_id        INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    title           TEXT NOT NULL,
    difficulty      TEXT NOT NULL CHECK (difficulty IN ('Beginner', 'Intermediate', 'Advanced')),
    pass_score      INTEGER NOT NULL DEFAULT 60 CHECK (pass_score BETWEEN 1 AND 100),
    created_by      INTEGER REFERENCES users(id),
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS assessment_questions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    assessment_id   INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    question_text   TEXT NOT NULL,
    options_json    TEXT NOT NULL,
    correct_index   INTEGER NOT NULL CHECK (correct_index >= 0),
    weight          INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS assessment_attempts (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    assessment_id   INTEGER NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    score           INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
    awarded_level   INTEGER NOT NULL CHECK (awarded_level BETWEEN 1 AND 5),
    passed          INTEGER NOT NULL,
    attempted_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_attempts_user ON assessment_attempts(user_id);

CREATE TABLE IF NOT EXISTS courses (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    educator_id     INTEGER NOT NULL REFERENCES users(id),
    title           TEXT NOT NULL,
    provider        TEXT NOT NULL,
    description     TEXT NOT NULL,
    difficulty      TEXT NOT NULL CHECK (difficulty IN ('Beginner', 'Intermediate', 'Advanced')),
    duration_hours  INTEGER NOT NULL CHECK (duration_hours > 0),
    resource_url    TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_courses_educator ON courses(educator_id);

CREATE TABLE IF NOT EXISTS course_skills (
    course_id       INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    skill_id        INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    target_level    INTEGER NOT NULL CHECK (target_level BETWEEN 1 AND 5),
    PRIMARY KEY (course_id, skill_id)
);

CREATE TABLE IF NOT EXISTS enrollments (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id         INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    progress_percent  INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
    status            TEXT NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'in_progress', 'completed')),
    enrolled_at       TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at      TEXT,
    UNIQUE (user_id, course_id)
);
CREATE INDEX IF NOT EXISTS ix_enrollments_user ON enrollments(user_id);

CREATE TABLE IF NOT EXISTS certificates (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_id          INTEGER REFERENCES skills(id) ON DELETE SET NULL,
    title             TEXT NOT NULL,
    issuer            TEXT NOT NULL,
    issued_date       TEXT NOT NULL,
    verification_code TEXT NOT NULL UNIQUE,
    file_name         TEXT NOT NULL,
    blob_url          TEXT NOT NULL,
    file_hash_sha256  TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
    uploaded_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_certificates_user ON certificates(user_id);
CREATE INDEX IF NOT EXISTS ix_certificates_status ON certificates(status);

CREATE TABLE IF NOT EXISTS certificate_verifications (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    certificate_id  INTEGER NOT NULL REFERENCES certificates(id) ON DELETE CASCADE,
    verifier_id     INTEGER REFERENCES users(id),
    decision        TEXT NOT NULL CHECK (decision IN ('PENDING', 'VERIFIED', 'REJECTED')),
    notes           TEXT,
    verified_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jobs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    employer_id     INTEGER NOT NULL REFERENCES users(id),
    title           TEXT NOT NULL,
    company         TEXT NOT NULL,
    location        TEXT NOT NULL,
    employment_type TEXT NOT NULL DEFAULT 'Full-time',
    salary_range    TEXT,
    description     TEXT NOT NULL,
    is_open         INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_jobs_open ON jobs(is_open);

CREATE TABLE IF NOT EXISTS job_skills (
    job_id          INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    skill_id        INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    required_level  INTEGER NOT NULL CHECK (required_level BETWEEN 1 AND 5),
    is_mandatory    INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (job_id, skill_id)
);

CREATE TABLE IF NOT EXISTS applications (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id          INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    match_score     INTEGER NOT NULL CHECK (match_score BETWEEN 0 AND 100),
    status          TEXT NOT NULL DEFAULT 'APPLIED' CHECK (status IN ('APPLIED', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'REJECTED')),
    cover_note      TEXT,
    applied_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (job_id, user_id)
);
CREATE INDEX IF NOT EXISTS ix_applications_job ON applications(job_id);
CREATE INDEX IF NOT EXISTS ix_applications_user ON applications(user_id);

CREATE TABLE IF NOT EXISTS activity_logs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action          TEXT NOT NULL,
    entity_type     TEXT,
    entity_id       INTEGER,
    details         TEXT,
    ip_address      TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ix_activity_logs_created ON activity_logs(created_at DESC);

-- ============================================================================
-- VIEWS
-- ============================================================================
CREATE VIEW IF NOT EXISTS vw_verified_certificates AS
SELECT
    c.id AS certificate_id,
    c.verification_code,
    c.title AS certificate_title,
    c.issuer,
    c.issued_date,
    c.status,
    c.file_hash_sha256,
    u.id AS learner_id,
    u.full_name AS learner_name,
    u.email AS learner_email,
    s.name AS skill_name
FROM certificates c
JOIN users u ON u.id = c.user_id
LEFT JOIN skills s ON s.id = c.skill_id;

CREATE VIEW IF NOT EXISTS vw_learner_skill_gaps AS
SELECT
    u.id AS user_id,
    u.full_name,
    j.id AS job_id,
    j.title AS job_title,
    j.company,
    s.id AS skill_id,
    s.name AS skill_name,
    js.required_level,
    COALESCE(us.proficiency_level, 0) AS current_level,
    CASE
        WHEN COALESCE(us.proficiency_level, 0) >= js.required_level THEN 0
        ELSE js.required_level - COALESCE(us.proficiency_level, 0)
    END AS gap_level,
    COALESCE(us.verified, 0) AS is_verified
FROM users u
CROSS JOIN jobs j
JOIN job_skills js ON js.job_id = j.id
JOIN skills s ON s.id = js.skill_id
LEFT JOIN user_skills us ON us.user_id = u.id AND us.skill_id = s.id
WHERE u.role = 'learner' AND j.is_open = 1;

CREATE VIEW IF NOT EXISTS vw_analytics_overview AS
SELECT
    (SELECT COUNT(*) FROM users WHERE role = 'learner') AS total_learners,
    (SELECT COUNT(*) FROM users WHERE role = 'educator') AS total_educators,
    (SELECT COUNT(*) FROM users WHERE role = 'employer') AS total_employers,
    (SELECT COUNT(*) FROM courses) AS total_courses,
    (SELECT COUNT(*) FROM enrollments WHERE status = 'completed') AS completed_enrollments,
    (SELECT COUNT(*) FROM certificates WHERE status = 'VERIFIED') AS verified_certificates,
    (SELECT COUNT(*) FROM jobs WHERE is_open = 1) AS open_jobs,
    (SELECT COUNT(*) FROM applications) AS total_applications;

-- ============================================================================
-- TRIGGERS
-- ============================================================================
CREATE TRIGGER IF NOT EXISTS trg_certificate_status_audit
AFTER UPDATE OF status ON certificates
WHEN OLD.status != NEW.status
BEGIN
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
        NEW.user_id,
        'CERTIFICATE_STATUS_CHANGED',
        'certificate',
        NEW.id,
        'Status changed from ' || OLD.status || ' to ' || NEW.status || ' (Code: ' || NEW.verification_code || ')'
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_application_status_audit
AFTER UPDATE OF status ON applications
WHEN OLD.status != NEW.status
BEGIN
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
    VALUES (
        NEW.user_id,
        'APPLICATION_STATUS_CHANGED',
        'application',
        NEW.id,
        'Job #' || NEW.job_id || ' status changed from ' || OLD.status || ' to ' || NEW.status
    );
END;
