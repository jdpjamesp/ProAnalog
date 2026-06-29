import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

let db: Database.Database

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialised — call initDb() first')
  return db
}

export function initDb(): void {
  const dbPath = join(app.getPath('userData'), 'proanalog.db')
  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  applySchema(db)
}

function applySchema(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT    NOT NULL,
      filename    TEXT    NOT NULL,
      filepath    TEXT    NOT NULL,
      file_size   INTEGER NOT NULL DEFAULT 0,
      chunk_count INTEGER NOT NULL DEFAULT 0,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
      updated_at  INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
    );

    CREATE TABLE IF NOT EXISTS queries (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id  INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      question    TEXT    NOT NULL,
      answer      TEXT    NOT NULL DEFAULT '',
      chunks_used TEXT    NOT NULL DEFAULT '[]',
      tokens_used INTEGER NOT NULL DEFAULT 0,
      created_at  INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
    );

    CREATE INDEX IF NOT EXISTS idx_queries_session ON queries(session_id);

    CREATE TABLE IF NOT EXISTS settings (
      key         TEXT    PRIMARY KEY,
      value       TEXT    NOT NULL DEFAULT 'null',
      updated_at  INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
    );
  `)
}
