import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { env } from './env.js';

let dbInstance = null;

/**
 * Opens (or returns the cached) SQLite connection with foreign keys enabled.
 * Mirrors the Azure SQL database interface used by services and routes.
 */
export function getDb(customPath) {
  if (dbInstance) return dbInstance;

  const targetPath = customPath || env.sqlitePath;
  if (targetPath !== ':memory:') {
    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  }

  dbInstance = new DatabaseSync(targetPath);
  dbInstance.exec('PRAGMA foreign_keys = ON;');
  dbInstance.exec('PRAGMA journal_mode = WAL;');
  return dbInstance;
}

export function closeDb() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function queryAll(sql, ...params) {
  return getDb().prepare(sql).all(...params);
}

export function queryOne(sql, ...params) {
  return getDb().prepare(sql).get(...params) ?? null;
}

export function run(sql, ...params) {
  return getDb().prepare(sql).run(...params);
}

/**
 * Executes a callback inside an atomic database transaction.
 */
export function withTransaction(fn) {
  const db = getDb();
  db.exec('BEGIN IMMEDIATE;');
  try {
    const result = fn(db);
    db.exec('COMMIT;');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK;');
    } catch {
      // Ignore rollback errors if transaction already closed
    }
    throw err;
  }
}
