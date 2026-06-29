import type { Session } from '../../shared/types'
import { getDb } from './index'

export function listSessions(): Session[] {
  return getDb()
    .prepare('SELECT * FROM sessions ORDER BY updated_at DESC')
    .all() as Session[]
}

export function getSession(id: number): Session | undefined {
  return getDb()
    .prepare('SELECT * FROM sessions WHERE id = ?')
    .get(id) as Session | undefined
}

export function createSession(data: {
  name: string
  filename: string
  filepath: string
  file_size: number
}): Session {
  const db = getDb()
  const now = Date.now()
  const result = db
    .prepare(`
      INSERT INTO sessions (name, filename, filepath, file_size, created_at, updated_at)
      VALUES (@name, @filename, @filepath, @file_size, @now, @now)
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

export function deleteSession(id: number): void {
  getDb()
    .prepare('DELETE FROM sessions WHERE id = ?')
    .run(id)
}
