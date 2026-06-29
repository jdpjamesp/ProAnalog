import type { Setting } from '../../shared/types'
import { getDb } from './index'

export function getSetting<T>(key: string): T | null {
  const row = getDb()
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(key) as { value: string } | undefined
  return row ? (JSON.parse(row.value) as T) : null
}

export function setSetting<T>(key: string, value: T): void {
  getDb()
    .prepare(`
      INSERT INTO settings (key, value, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
    `)
    .run(key, JSON.stringify(value), Date.now())
}

export function getAllSettings(): Record<string, unknown> {
  const rows = getDb()
    .prepare('SELECT key, value FROM settings')
    .all() as Setting[]
  return Object.fromEntries(rows.map((r) => [r.key, JSON.parse(r.value)]))
}
