# CareerForge

CareerForge is a unified full-stack platform that bridges the gap between student/job-seeker competencies and employer requirements through **skill assessments, gap analysis, personalized learning pathways, cryptographic certificate verification, algorithmic job matching, and career analytics**.

## Tech Stack
- **Frontend (Presentation Tier):** React.js (Vite), HTML5, CSS3, JavaScript
- **Backend (Application Tier):** Node.js, Express.js, JWT, bcryptjs, Helmet, Multer, TTL Caching
- **Database (Data Tier):** Normalized RDBMS (`database/azure_sql_schema.sql` for Azure SQL T-SQL + `database/sqlite_schema.sql` for zero-config local execution via Node.js `node:sqlite`)
- **Storage & Analytics (DP-900):** Azure Blob Storage abstraction (`server/src/services/storageService.js`) + Microsoft Power BI integration (`/api/analytics/powerbi-feed`)

## Quick Start (Local MVP)

1. Install dependencies (already installed if scaffolded together):
   ```powershell
   npm run install:all
   ```
2. Start the Backend API (`http://localhost:4000`):
   ```powershell
   npm run dev:server
   ```
   *(Auto-initializes SQLite schema and seeds demo accounts on first launch; run `npm run seed` anytime to reset demo data.)*
3. In a second terminal, start the React Frontend (`http://localhost:5173`):
   ```powershell
   npm run dev:client
   ```
4. Run automated API & RDBMS integration tests:
   ```powershell
   npm test
   ```

## Demo Accounts (Password: `Password123!`)
| Role | Email | Capabilities |
| :--- | :--- | :--- |
| **Learner** | `aarav@careerforge.dev` | Assessments, Gap Analysis, Course Enrollment/Completion, Certificate Upload, Job Matching & Applications |
| **Educator** | `maya@careerforge.dev` | Publish Courses with Skill Mappings, Verify Certificates |
| **Employer** | `rohan@careerforge.dev` | Post Jobs with Required Skills, Review Ranked Applicants, Update Status |
| **Verifier** | `verifier@careerforge.dev` | Audit Pending Certificates, Verify/Reject with Atomic Skill Trust Updates |

## Project Structure
- `database/azure_sql_schema.sql` — Production Azure SQL T-SQL schema with 3NF tables, indexes, views, triggers, and stored procedures (`sp_VerifyCertificate`, `sp_CompleteCourseAndUpdateSkill`)
- `database/sqlite_schema.sql` — Local SQLite mirror schema with views and audit triggers
- `server/` — Express REST API, RBAC security middleware, DSA matching engine, SHA-256 certificate storage, and `node --test` suite
- `client/` — React SPA with role-aware dashboards and interactive workflows
- `docs/ARCHITECTURE.md` & `docs/POWER_BI_GUIDE.md` — System Design, RDBMS, DP-900, and Cloud Security reference
