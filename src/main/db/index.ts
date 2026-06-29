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
  migrate(db)
}

// ── Migrations ───────────────────────────────────────────────────────────────
// user_version 0 = original single-file schema
// user_version 1 = multi-file schema: sessions drops filename/filepath/file_size,
//                  gains file_count; new session_files table

function migrate(db: Database.Database): void {
  const version = (db.pragma('user_version', { simple: true }) as number)

  if (version < 1) {
    db.transaction(() => {
      // Preserve existing sessions rows if any, migrating what columns survive
      db.exec(`
        CREATE TABLE IF NOT EXISTS sessions_v1 (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          name        TEXT    NOT NULL,
          chunk_count INTEGER NOT NULL DEFAULT 0,
          file_count  INTEGER NOT NULL DEFAULT 0,
          created_at  INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000),
          updated_at  INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
        );

        INSERT OR IGNORE INTO sessions_v1 (id, name, chunk_count, created_at, updated_at)
        SELECT id, name, chunk_count, created_at, updated_at
        FROM sessions
        WHERE EXISTS (SELECT 1 FROM sqlite_master WHERE type='table' AND name='sessions');

        DROP TABLE IF EXISTS sessions;
        ALTER TABLE sessions_v1 RENAME TO sessions;

        CREATE TABLE IF NOT EXISTS session_files (
          id         INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id INTEGER NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
          filename   TEXT    NOT NULL,
          filepath   TEXT    NOT NULL,
          file_size  INTEGER NOT NULL DEFAULT 0,
          log_type   TEXT    NOT NULL,
          line_count INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT (unixepoch('now') * 1000)
        );

        CREATE INDEX IF NOT EXISTS idx_session_files_session ON session_files(session_id);

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
      db.pragma('user_version = 1')
    })()
  }
}
