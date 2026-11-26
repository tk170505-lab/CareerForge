# CareerForge — Backend API & Database

Application & Data tier for CareerForge built with Node.js, Express.js, JWT + RBAC security, bcrypt, TTL caching, and SQLite / Azure SQL T-SQL schemas.

## Quick Start
`ash
cp .env.example .env
npm install
npm run seed
npm start
`
Runs on http://localhost:4000.

## Run Integration Tests
`ash
npm test
`

## Included Directories
- src/ — Express REST API, RBAC/JWT middleware, DSA matching service, caching, SHA-256 certificate storage
- database/ — zure_sql_schema.sql (T-SQL) and sqlite_schema.sql
- 	ests/ — 
ode --test API & RDBMS integration suite
- docs/ — Architecture and Power BI guides
