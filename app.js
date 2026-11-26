import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from './config/env.js';
import authRoutes from './routes/auth.routes.js';
import skillsRoutes from './routes/skills.routes.js';
import assessmentsRoutes from './routes/assessments.routes.js';
import learningRoutes from './routes/learning.routes.js';
import certificatesRoutes from './routes/certificates.routes.js';
import jobsRoutes from './routes/jobs.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDistDir = path.resolve(__dirname, '../../client/dist');

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
    })
  );
  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));

  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api', apiLimiter);

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'CareerForge REST API',
      timestamp: new Date().toISOString(),
    });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/skills', skillsRoutes);
  app.use('/api/assessments', assessmentsRoutes);
  app.use('/api/learning', learningRoutes);
  app.use('/api/certificates', certificatesRoutes);
  app.use('/api/jobs', jobsRoutes);
  app.use('/api/analytics', analyticsRoutes);

  app.use('/api/*', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Serve built React frontend as a unified full-stack website when client/dist exists
  if (fs.existsSync(clientDistDir)) {
    app.use(express.static(clientDistDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(clientDistDir, 'index.html'));
    });
  }

  app.use((err, _req, res, _next) => {
    const status = err.status || 400;
    res.status(status).json({ error: err.message || 'Internal server error.' });
  });

  return app;
}
