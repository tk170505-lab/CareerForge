import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(__dirname, '../..');
const isVercel = Boolean(process.env.VERCEL);
const localSchemaDir = path.resolve(serverRoot, './database');
const parentSchemaDir = path.resolve(serverRoot, '../database');

dotenv.config({ path: path.join(serverRoot, '.env') });

export const env = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  isVercel,
  jwtSecret: process.env.JWT_SECRET || 'careerforge-dev-secret-do-not-use-in-prod',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  corsOrigin: process.env.CORS_ORIGIN || (isVercel ? true : 'http://localhost:5173'),
  dbClient: process.env.DB_CLIENT || 'sqlite',
  sqlitePath: process.env.SQLITE_PATH
    ? path.resolve(serverRoot, process.env.SQLITE_PATH)
    : isVercel
      ? '/tmp/careerforge.db'
      : path.resolve(serverRoot, './data/careerforge.db'),
  schemaDir: fs.existsSync(localSchemaDir) ? localSchemaDir : parentSchemaDir,
  storageProvider: process.env.STORAGE_PROVIDER || 'local',
  uploadDir: isVercel
    ? '/tmp/careerforge-uploads/certificates'
    : path.resolve(serverRoot, './uploads/certificates'),
  azureStorageConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING || '',
  azureStorageContainer: process.env.AZURE_STORAGE_CONTAINER || 'certificates',
};
