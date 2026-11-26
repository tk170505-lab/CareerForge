# Power BI Analytics Integration Guide (DP-900)

CareerForge exposes pre-aggregated relational views and API feeds designed for **Microsoft Power BI Desktop / Power BI Service**.

## Option A: DirectQuery / Import from Azure SQL Database
1. Provision Azure SQL Database and execute `database/azure_sql_schema.sql`.
2. In Power BI Desktop, choose **Get Data → Azure → Azure SQL database**.
3. Enter your Azure SQL server and database (`careerforge_db`), select **DirectQuery** (real-time) or **Import**, and load:
   - `vw_analytics_overview` (KPI cards: learners, verified certificates, open jobs, completed courses)
   - `vw_learner_skill_gaps` (Skill gap heatmap by target role & skill category)
   - `vw_verified_certificates` (Verification throughput, issuer distribution)
   - `skills`, `jobs`, `applications`, `enrollments`

## Option B: Connect to the Local MVP REST/CSV Feed
1. From the CareerForge **Analytics Dashboard**, click **Export CSV for Power BI** (calls `GET /api/analytics/powerbi-feed?format=csv`).
2. Or connect Power BI **Get Data → Web** to `GET /api/analytics/powerbi-feed` with a Bearer token header to ingest the JSON model (`skillDemandVsSupply`, `certificateBreakdown`, `applicationFunnel`, `topSkillGaps`).
