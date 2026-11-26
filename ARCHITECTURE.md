# CareerForge — Architecture, RDBMS, DP-900 & Cloud Security

## 1. Three-Tier System Design
1. **Presentation Tier (`client/`):** React 19 SPA communicating exclusively over REST JSON / multipart APIs (`/api/*`).
2. **Application Tier (`server/`):** Express.js REST API implementing:
   - Domain routers: `/api/auth`, `/api/skills`, `/api/assessments`, `/api/learning`, `/api/certificates`, `/api/jobs`, `/api/analytics`
   - **Cache-Aside TTL Layer (`server/src/utils/cache.js`):** Caches high-read endpoints (`GET /api/skills`, `GET /api/learning/courses`, `GET /api/jobs`, platform analytics) and invalidates affected prefixes on writes.
   - **DSA Matching Engine (`server/src/services/matchingService.js`):** Uses O(1) `Map` lookups and weighted scoring across mandatory vs. optional skills and verified credential bonuses.
3. **Data Tier (`database/`):** Relational SQL schema + Blob document storage.

## 2. Relational Database Management System (RDBMS)
- **Normalization (3NF):** Separate entities for `users`, `skills`, `user_skills`, `assessments`, `assessment_questions`, `assessment_attempts`, `courses`, `course_skills`, `enrollments`, `certificates`, `certificate_verifications`, `jobs`, `job_skills`, `applications`, and `activity_logs`.
- **Integrity & Performance:** Composite primary keys on junction tables (`course_skills`, `job_skills`), `CHECK` constraints, `UNIQUE` constraints, and targeted secondary indexes (`ix_users_role`, `ix_certificates_status`, `ix_applications_job`, etc.).
- **Views:** `vw_verified_certificates`, `vw_learner_skill_gaps`, `vw_analytics_overview`.
- **Triggers:** `trg_certificate_status_audit` and `trg_application_status_audit` automatically write audit records whenever certificate or application states change.
- **Transactions & Stored Procedures:** `sp_VerifyCertificate` and `sp_CompleteCourseAndUpdateSkill` (and their transactional equivalents in Express) ensure multi-table updates succeed atomically or roll back completely.

## 3. DP-900 (Microsoft Azure Data Services)
- **Structured Operational & Analytical Data:** `database/azure_sql_schema.sql` targets **Azure SQL Database (T-SQL)**.
- **Unstructured Credential Artifacts:** `server/src/services/storageService.js` implements an **Azure Blob Storage** pattern (container `certificates`, SHA-256 integrity digest stored in SQL, SAS/authenticated download route, with zero-config local disk emulation when `AZURE_STORAGE_CONNECTION_STRING` is unset).
- **Business Intelligence:** Power BI connects directly to Azure SQL views or consumes `/api/analytics/powerbi-feed` (JSON / CSV).

## 4. Cloud Security Controls
- **Authentication & Passwords:** `bcryptjs` (salted adaptive hashing) + signed JWT Bearer tokens (`8h` expiry).
- **RBAC:** `authorizeRoles(...)` middleware enforces least-privilege access across `learner`, `educator`, `employer`, and `verifier`.
- **OWASP Protections:** Parameterized SQL queries everywhere (SQLi defense), script-stripping input sanitization + React JSX escaping (XSS defense), `helmet` security headers, CORS origin restriction, and `express-rate-limit`.
- **Network & Secret Hygiene:** Secrets externalized via `.env` (`.env.example` template provided); Azure SQL firewall/VNet rules documented for cloud deployment.
- **Auditability:** Security events (`USER_LOGIN`, `LOGIN_FAILED`, `CERTIFICATE_UPLOADED`, trigger-driven state changes) logged in `activity_logs`.
