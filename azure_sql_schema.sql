-- ============================================================================
-- CareerForge — Azure SQL Database (T-SQL) Production Schema
-- Demonstrates: 3NF Normalization, PK/FK constraints, Indexes, Views,
--               Triggers, and Stored Procedures with Transactions.
-- ============================================================================

-- 1. USERS & RBAC
CREATE TABLE users (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    full_name       NVARCHAR(120) NOT NULL,
    email           NVARCHAR(180) NOT NULL UNIQUE,
    password_hash   NVARCHAR(255) NOT NULL,
    role            NVARCHAR(20)  NOT NULL CHECK (role IN ('learner', 'educator', 'employer', 'verifier')),
    headline        NVARCHAR(200) NULL,
    organization    NVARCHAR(150) NULL,
    target_role     NVARCHAR(120) NULL,
    is_active       BIT NOT NULL DEFAULT 1,
    created_at      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX ix_users_role ON users(role);

-- 2. SKILLS CATALOG
CREATE TABLE skills (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    name            NVARCHAR(100) NOT NULL UNIQUE,
    category        NVARCHAR(80)  NOT NULL,
    description     NVARCHAR(500) NULL,
    created_at      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX ix_skills_category ON skills(category);

-- 3. USER SKILLS (Proficiency 1-5 + Verification Status)
CREATE TABLE user_skills (
    id                INT IDENTITY(1,1) PRIMARY KEY,
    user_id           INT NOT NULL FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE,
    skill_id          INT NOT NULL FOREIGN KEY REFERENCES skills(id) ON DELETE CASCADE,
    proficiency_level INT NOT NULL CHECK (proficiency_level BETWEEN 1 AND 5),
    verified          BIT NOT NULL DEFAULT 0,
    source            NVARCHAR(40) NOT NULL DEFAULT 'self' CHECK (source IN ('self', 'assessment', 'course', 'certificate')),
    last_assessed_at  DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT uq_user_skill UNIQUE (user_id, skill_id)
);
CREATE INDEX ix_user_skills_user ON user_skills(user_id);

-- 4. SKILL ASSESSMENTS & ATTEMPTS
CREATE TABLE assessments (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    skill_id        INT NOT NULL FOREIGN KEY REFERENCES skills(id) ON DELETE CASCADE,
    title           NVARCHAR(160) NOT NULL,
    difficulty      NVARCHAR(30) NOT NULL CHECK (difficulty IN ('Beginner', 'Intermediate', 'Advanced')),
    pass_score      INT NOT NULL DEFAULT 60 CHECK (pass_score BETWEEN 1 AND 100),
    created_by      INT NULL FOREIGN KEY REFERENCES users(id),
    created_at      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE assessment_questions (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    assessment_id   INT NOT NULL FOREIGN KEY REFERENCES assessments(id) ON DELETE CASCADE,
    question_text   NVARCHAR(600) NOT NULL,
    options_json    NVARCHAR(MAX) NOT NULL,
    correct_index   INT NOT NULL CHECK (correct_index >= 0),
    weight          INT NOT NULL DEFAULT 1
);

CREATE TABLE assessment_attempts (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    assessment_id   INT NOT NULL FOREIGN KEY REFERENCES assessments(id) ON DELETE CASCADE,
    user_id         INT NOT NULL FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE,
    score           INT NOT NULL CHECK (score BETWEEN 0 AND 100),
    awarded_level   INT NOT NULL CHECK (awarded_level BETWEEN 1 AND 5),
    passed          BIT NOT NULL,
    attempted_at    DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX ix_attempts_user ON assessment_attempts(user_id);

-- 5. COURSES & PERSONALIZED LEARNING
CREATE TABLE courses (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    educator_id     INT NOT NULL FOREIGN KEY REFERENCES users(id),
    title           NVARCHAR(180) NOT NULL,
    provider        NVARCHAR(120) NOT NULL,
    description     NVARCHAR(1000) NOT NULL,
    difficulty      NVARCHAR(30) NOT NULL CHECK (difficulty IN ('Beginner', 'Intermediate', 'Advanced')),
    duration_hours  INT NOT NULL CHECK (duration_hours > 0),
    resource_url    NVARCHAR(500) NULL,
    created_at      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX ix_courses_educator ON courses(educator_id);

CREATE TABLE course_skills (
    course_id       INT NOT NULL FOREIGN KEY REFERENCES courses(id) ON DELETE CASCADE,
    skill_id        INT NOT NULL FOREIGN KEY REFERENCES skills(id) ON DELETE CASCADE,
    target_level    INT NOT NULL CHECK (target_level BETWEEN 1 AND 5),
    PRIMARY KEY (course_id, skill_id)
);

CREATE TABLE enrollments (
    id                INT IDENTITY(1,1) PRIMARY KEY,
    user_id           INT NOT NULL FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE,
    course_id         INT NOT NULL FOREIGN KEY REFERENCES courses(id) ON DELETE CASCADE,
    progress_percent  INT NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
    status            NVARCHAR(20) NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'in_progress', 'completed')),
    enrolled_at       DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    completed_at      DATETIME2 NULL,
    CONSTRAINT uq_enrollment UNIQUE (user_id, course_id)
);
CREATE INDEX ix_enrollments_user ON enrollments(user_id);

-- 6. CERTIFICATES & VERIFICATION (Azure Blob Storage metadata + SHA-256 hash)
CREATE TABLE certificates (
    id                INT IDENTITY(1,1) PRIMARY KEY,
    user_id           INT NOT NULL FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE,
    skill_id          INT NULL FOREIGN KEY REFERENCES skills(id) ON DELETE SET NULL,
    title             NVARCHAR(180) NOT NULL,
    issuer            NVARCHAR(150) NOT NULL,
    issued_date       DATE NOT NULL,
    verification_code NVARCHAR(64) NOT NULL UNIQUE,
    file_name         NVARCHAR(255) NOT NULL,
    blob_url          NVARCHAR(600) NOT NULL,
    file_hash_sha256  CHAR(64) NOT NULL,
    status            NVARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
    uploaded_at       DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX ix_certificates_user ON certificates(user_id);
CREATE INDEX ix_certificates_status ON certificates(status);

CREATE TABLE certificate_verifications (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    certificate_id  INT NOT NULL FOREIGN KEY REFERENCES certificates(id) ON DELETE CASCADE,
    verifier_id     INT NULL FOREIGN KEY REFERENCES users(id),
    decision        NVARCHAR(20) NOT NULL CHECK (decision IN ('PENDING', 'VERIFIED', 'REJECTED')),
    notes           NVARCHAR(500) NULL,
    verified_at     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

-- 7. JOBS, REQUIRED SKILLS & APPLICATIONS
CREATE TABLE jobs (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    employer_id     INT NOT NULL FOREIGN KEY REFERENCES users(id),
    title           NVARCHAR(180) NOT NULL,
    company         NVARCHAR(150) NOT NULL,
    location        NVARCHAR(120) NOT NULL,
    employment_type NVARCHAR(40) NOT NULL DEFAULT 'Full-time',
    salary_range    NVARCHAR(80) NULL,
    description     NVARCHAR(1500) NOT NULL,
    is_open         BIT NOT NULL DEFAULT 1,
    created_at      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX ix_jobs_open ON jobs(is_open);

CREATE TABLE job_skills (
    job_id          INT NOT NULL FOREIGN KEY REFERENCES jobs(id) ON DELETE CASCADE,
    skill_id        INT NOT NULL FOREIGN KEY REFERENCES skills(id) ON DELETE CASCADE,
    required_level  INT NOT NULL CHECK (required_level BETWEEN 1 AND 5),
    is_mandatory    BIT NOT NULL DEFAULT 1,
    PRIMARY KEY (job_id, skill_id)
);

CREATE TABLE applications (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    job_id          INT NOT NULL FOREIGN KEY REFERENCES jobs(id) ON DELETE CASCADE,
    user_id         INT NOT NULL FOREIGN KEY REFERENCES users(id) ON DELETE CASCADE,
    match_score     INT NOT NULL CHECK (match_score BETWEEN 0 AND 100),
    status          NVARCHAR(20) NOT NULL DEFAULT 'APPLIED' CHECK (status IN ('APPLIED', 'SHORTLISTED', 'INTERVIEW', 'OFFERED', 'REJECTED')),
    cover_note      NVARCHAR(1000) NULL,
    applied_at      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    updated_at      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
    CONSTRAINT uq_job_application UNIQUE (job_id, user_id)
);
CREATE INDEX ix_applications_job ON applications(job_id);
CREATE INDEX ix_applications_user ON applications(user_id);

-- 8. CLOUD SECURITY ACTIVITY LOGGING
CREATE TABLE activity_logs (
    id              INT IDENTITY(1,1) PRIMARY KEY,
    user_id         INT NULL FOREIGN KEY REFERENCES users(id) ON DELETE SET NULL,
    action          NVARCHAR(100) NOT NULL,
    entity_type     NVARCHAR(60)  NULL,
    entity_id       INT NULL,
    details         NVARCHAR(1000) NULL,
    ip_address      NVARCHAR(64)  NULL,
    created_at      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX ix_activity_logs_created ON activity_logs(created_at DESC);
GO

-- ============================================================================
-- VIEWS (Used by API & Power BI Analytics)
-- ============================================================================
CREATE VIEW vw_verified_certificates AS
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
GO

CREATE VIEW vw_learner_skill_gaps AS
SELECT
    u.id AS user_id,
    u.full_name,
    j.id AS job_id,
    j.title AS job_title,
    j.company,
    s.id AS skill_id,
    s.name AS skill_name,
    js.required_level,
    ISNULL(us.proficiency_level, 0) AS current_level,
    CASE
        WHEN ISNULL(us.proficiency_level, 0) >= js.required_level THEN 0
        ELSE js.required_level - ISNULL(us.proficiency_level, 0)
    END AS gap_level,
    ISNULL(us.verified, 0) AS is_verified
FROM users u
CROSS JOIN jobs j
JOIN job_skills js ON js.job_id = j.id
JOIN skills s ON s.id = js.skill_id
LEFT JOIN user_skills us ON us.user_id = u.id AND us.skill_id = s.id
WHERE u.role = 'learner' AND j.is_open = 1;
GO

CREATE VIEW vw_analytics_overview AS
SELECT
    (SELECT COUNT(*) FROM users WHERE role = 'learner') AS total_learners,
    (SELECT COUNT(*) FROM users WHERE role = 'educator') AS total_educators,
    (SELECT COUNT(*) FROM users WHERE role = 'employer') AS total_employers,
    (SELECT COUNT(*) FROM courses) AS total_courses,
    (SELECT COUNT(*) FROM enrollments WHERE status = 'completed') AS completed_enrollments,
    (SELECT COUNT(*) FROM certificates WHERE status = 'VERIFIED') AS verified_certificates,
    (SELECT COUNT(*) FROM jobs WHERE is_open = 1) AS open_jobs,
    (SELECT COUNT(*) FROM applications) AS total_applications;
GO

-- ============================================================================
-- TRIGGERS (Audit Trail Automation)
-- ============================================================================
CREATE TRIGGER trg_certificate_status_audit
ON certificates
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
    SELECT
        i.user_id,
        'CERTIFICATE_STATUS_CHANGED',
        'certificate',
        i.id,
        CONCAT('Status changed from ', d.status, ' to ', i.status, ' (Code: ', i.verification_code, ')')
    FROM inserted i
    JOIN deleted d ON i.id = d.id
    WHERE i.status <> d.status;
END;
GO

CREATE TRIGGER trg_application_status_audit
ON applications
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO activity_logs (user_id, action, entity_type, entity_id, details)
    SELECT
        i.user_id,
        'APPLICATION_STATUS_CHANGED',
        'application',
        i.id,
        CONCAT('Job #', i.job_id, ' status changed from ', d.status, ' to ', i.status)
    FROM inserted i
    JOIN deleted d ON i.id = d.id
    WHERE i.status <> d.status;
END;
GO

-- ============================================================================
-- STORED PROCEDURES (Transactional Integrity)
-- ============================================================================
CREATE PROCEDURE sp_VerifyCertificate
    @CertificateId INT,
    @VerifierId INT,
    @Decision NVARCHAR(20),
    @Notes NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        UPDATE certificates
        SET status = @Decision
        WHERE id = @CertificateId;

        INSERT INTO certificate_verifications (certificate_id, verifier_id, decision, notes)
        VALUES (@CertificateId, @VerifierId, @Decision, @Notes);

        IF @Decision = 'VERIFIED'
        BEGIN
            DECLARE @UserId INT, @SkillId INT;
            SELECT @UserId = user_id, @SkillId = skill_id
            FROM certificates WHERE id = @CertificateId;

            IF @SkillId IS NOT NULL
            BEGIN
                IF EXISTS (SELECT 1 FROM user_skills WHERE user_id = @UserId AND skill_id = @SkillId)
                    UPDATE user_skills
                    SET verified = 1, source = 'certificate', last_assessed_at = SYSUTCDATETIME()
                    WHERE user_id = @UserId AND skill_id = @SkillId;
                ELSE
                    INSERT INTO user_skills (user_id, skill_id, proficiency_level, verified, source)
                    VALUES (@UserId, @SkillId, 3, 1, 'certificate');
            END
        END

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO

CREATE PROCEDURE sp_CompleteCourseAndUpdateSkill
    @UserId INT,
    @CourseId INT
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        UPDATE enrollments
        SET progress_percent = 100,
            status = 'completed',
            completed_at = SYSUTCDATETIME()
        WHERE user_id = @UserId AND course_id = @CourseId;

        MERGE user_skills AS target
        USING (
            SELECT skill_id, target_level FROM course_skills WHERE course_id = @CourseId
        ) AS src
        ON target.user_id = @UserId AND target.skill_id = src.skill_id
        WHEN MATCHED THEN
            UPDATE SET
                proficiency_level = CASE WHEN target.proficiency_level < src.target_level THEN src.target_level ELSE target.proficiency_level END,
                source = CASE WHEN target.verified = 1 THEN target.source ELSE 'course' END,
                last_assessed_at = SYSUTCDATETIME()
        WHEN NOT MATCHED THEN
            INSERT (user_id, skill_id, proficiency_level, verified, source)
            VALUES (@UserId, src.skill_id, src.target_level, 0, 'course');

        COMMIT TRANSACTION;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
        THROW;
    END CATCH
END;
GO
