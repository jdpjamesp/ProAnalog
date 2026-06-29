import type { Query, ChunkRef } from '../../shared/types'
import { getDb } from './index'

export function listQueries(sessionId: number): Query[] {
  return getDb()
    .prepare('SELECT * FROM queries WHERE session_id = ? ORDER BY created_at ASC')
    .all(sessionId) as Query[]
}

export function createQuery(data: {
  session_id: number
  question: string
  answer: string
  chunks_used: ChunkRef[]
  tokens_used: number
}): Query {
  const db = getDb()
  const now = Date.now()
  const result = db
    .prepare(`
      INSERT INTO queries (session_id, question, answer, chunks_used, tokens_used, created_at)
      VALUES (@session_id, @question, @answer, @chunks_used, @tokens_used, @now)
    `)
    .run({
      session_id:  data.session_id,
      question:    data.question,
      answer:      data.answer,
      chunks_used: JSON.stringify(data.chunks_used),
      tokens_used: data.tokens_used,
      now,
    })
  return db
    .prepare('SELECT * FROM queries WHERE id = ?')
    .get(result.lastInsertRowid) as Query
}
