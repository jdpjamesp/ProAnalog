import type { Session, SessionFile } from '../../shared/types'
import { getDb } from './index'

// ── Sessions ─────────────────────────────────────────────────────────────────

export function listSessions(): Session[] {
  return getDb()
    .prepare(`
      SELECT s.*, COUNT(q.id) as query_count
      FROM sessions s
      LEFT JOIN queries q ON q.session_id = s.id
      GROUP BY s.id
      ORDER BY s.updated_at DESC
    `)
    .all() as Session[]
}

export function getSession(id: number): Session | undefined {
  return getDb()
    .prepare('SELECT * FROM sessions WHERE id = ?')
    .get(id) as Session | undefined
}

export function createSession(data: { name: string }): Session {
  const db = getDb()
  const now = Date.now()
  const result = db
    .prepare(`
      INSERT INTO sessions (name, created_at, updated_at)
      VALUES (@name, @now, @now)
    `)
    .run({ ...data, now })
  return getSession(result.lastInsertRowid as number)!
}

export function renameSession(id: number, name: string): void {
  getDb()
    .prepare('UPDATE sessions SET name = ?, updated_at = ? WHERE id = ?')
    .run(name, Date.now(), id)
}

export function updateSessionChunkCount(id: number, chunk_count: number): void {
  getDb()
    .prepare('UPDATE sessions SET chunk_count = ?, updated_at = ? WHERE id = ?')
    .run(chunk_count, Date.now(), id)
}

export function updateSessionUpdatedAt(id: number): void {
  getDb()
    .prepare('UPDATE sessions SET updated_at = ? WHERE id = ?')
    .run(Date.now(), id)
}

export function deleteSession(id: number): void {
  getDb()
    .prepare('DELETE FROM sessions WHERE id = ?')
    .run(id)
}

// ── Session files ─────────────────────────────────────────────────────────────

export function listSessionFiles(sessionId: number): SessionFile[] {
  return getDb()
    .prepare('SELECT * FROM session_files WHERE session_id = ? ORDER BY id ASC')
    .all(sessionId) as SessionFile[]
}

export function addSessionFile(data: {
  session_id: number
  filename: string
  filepath: string
  file_size: number
  log_type: string
  line_count: number
}): SessionFile {
  const db = getDb()
  const now = Date.now()
  const result = db
    .prepare(`
      INSERT INTO session_files (session_id, filename, filepath, file_size, log_type, line_count, created_at)
      VALUES (@session_id, @filename, @filepath, @file_size, @log_type, @line_count, @now)
    `)
    .run({ ...data, now })

  db.prepare('UPDATE sessions SET file_count = file_count + 1, updated_at = ? WHERE id = ?')
    .run(now, data.session_id)

  return db
    .prepare('SELECT * FROM session_files WHERE id = ?')
    .get(result.lastInsertRowid as number) as SessionFile
}
