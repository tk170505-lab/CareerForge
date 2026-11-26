import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';

/**
 * Abstracts certificate document storage.
 * Uses local disk in development and documents/routes Azure Blob Storage
 * metadata patterns for DP-900 production deployments.
 */
export function generateVerificationCode() {
  const year = new Date().getUTCFullYear();
  const token = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `CF-CERT-${year}-${token}`;
}

export function sha256Buffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

export async function storeCertificateArtifact({ originalName, buffer, title, issuer, learnerEmail }) {
  fs.mkdirSync(env.uploadDir, { recursive: true });

  const safeBase = path
    .basename(originalName || 'certificate.txt')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 80);

  const payload =
    buffer && buffer.length > 0
      ? buffer
      : Buffer.from(
          JSON.stringify(
            {
              platform: 'CareerForge',
              title,
              issuer,
              learnerEmail,
              generatedAt: new Date().toISOString(),
            },
            null,
            2
          ),
          'utf8'
        );

  const fileHashSha256 = sha256Buffer(payload);
  const storedFileName = `${Date.now()}-${crypto.randomBytes(3).toString('hex')}-${safeBase}`;
  const fullPath = path.join(env.uploadDir, storedFileName);
  fs.writeFileSync(fullPath, payload);

  const storageMode = env.azureStorageConnectionString ? 'azure-blob-configured' : 'local-blob-emulator';
  const blobUrl =
    env.azureStorageConnectionString
      ? `https://careerforge.blob.core.windows.net/${env.azureStorageContainer}/${storedFileName}`
      : `/api/certificates/files/${storedFileName}`;

  return {
    fileName: safeBase,
    storedFileName,
    blobUrl,
    fileHashSha256,
    storageMode,
  };
}

export function resolveSafeCertificatePath(storedFileName) {
  const cleanName = path.basename(storedFileName);
  const resolved = path.resolve(env.uploadDir, cleanName);
  if (!resolved.startsWith(path.resolve(env.uploadDir))) {
    return null;
  }
  return fs.existsSync(resolved) ? resolved : null;
}
