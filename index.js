import { env } from './config/env.js';
import { initializeDatabase } from './db/init.js';
import { createApp } from './app.js';

initializeDatabase({ seedIfEmpty: true });

const app = createApp();
app.listen(env.port, () => {
  console.log(`CareerForge API listening on http://localhost:${env.port}`);
});
