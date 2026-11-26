import express from 'express';
import { queryAll, queryOne } from '../config/db.js';
import { env } from '../config/env.js';
import { authenticate } from '../middleware/auth.js';
import { cache } from '../utils/cache.js';
import { getPlatformOverview, getPowerBiFeed, getUserDashboard } from '../services/analyticsService.js';

const router = express.Router();

router.get('/public-summary', (_req, res) => {
  const platform = getPlatformOverview();
  res.json({
    overview: platform.overview,
    topSkills: platform.skillDemandVsSupply.slice(0, 6),
    certificateBreakdown: platform.certificateBreakdown,
  });
});

router.post('/cache/clear', authenticate, (_req, res) => {
  cache.clear();
  res.json({ message: 'API cache cleared.', cache: cache.stats() });
});

router.get('/dashboard', authenticate, (req, res) => {
  const data = getUserDashboard(req.user);
  res.json(data);
});

router.get('/powerbi-feed', authenticate, (req, res) => {
  const feed = getPowerBiFeed();

  if (req.query.format === 'csv') {
    const rows = [
      'skill_name,category,job_demand_count,learner_supply_count,verified_learner_count,avg_proficiency',
      ...feed.skillDemandVsSupply.map(
        (r) =>
          `"${r.skill_name}","${r.category}",${r.job_demand_count},${r.learner_supply_count},${r.verified_learner_count},${r.avg_proficiency}`
      ),
    ];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="careerforge-powerbi-skills.csv"');
    return res.send(rows.join('\n'));
  }

  return res.json(feed);
});

router.get('/system-health', authenticate, (_req, res) => {
  const recentLogs = queryAll(`
    SELECT al.*, u.full_name, u.role
    FROM activity_logs al
    LEFT JOIN users u ON u.id = al.user_id
    ORDER BY al.id DESC
    LIMIT 20
  `);

  const viewCounts = {
    vw_analytics_overview: queryOne('SELECT * FROM vw_analytics_overview'),
    vw_verified_certificates_rows: queryOne('SELECT COUNT(*) AS count FROM vw_verified_certificates')?.count || 0,
    vw_learner_skill_gaps_rows: queryOne('SELECT COUNT(*) AS count FROM vw_learner_skill_gaps')?.count || 0,
  };

  res.json({
    architecture: {
      tiers: ['React.js SPA (Presentation)', 'Node.js + Express REST API (Application)', 'RDBMS / Azure SQL + Blob Storage (Data)'],
      dbClient: env.dbClient,
      storageProvider: env.azureStorageConnectionString ? 'azure-blob' : 'local-blob-emulator',
      securityControls: [
        'JWT Bearer Authentication',
        'Role-Based Access Control (learner, educator, employer, verifier)',
        'bcrypt Password Hashing (cost 10)',
        'Helmet HTTP Security Headers',
        'Parameterized SQL Queries (SQLi Prevention)',
        'Input Validation & Script Sanitization (XSS Prevention)',
        'Express Rate Limiting & Audit Activity Logs',
      ],
    },
    cache: cache.stats(),
    databaseViews: viewCounts,
    recentActivityLogs: recentLogs,
  });
});

export default router;
