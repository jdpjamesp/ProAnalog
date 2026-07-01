import * as lancedb from '@lancedb/lancedb'
import { app } from 'electron'
import { join } from 'path'
import type { VectorRecord } from './types'

let connection: lancedb.Connection | null = null

async function getConnection(): Promise<lancedb.Connection> {
  if (!connection) {
    const dbPath = join(app.getPath('userData'), 'lancedb')
    connection = await lancedb.connect(dbPath)
  }
  return connection
}

function tableName(sessionId: number): string {
  return `session_${sessionId}`
}

export async function storeVectors(sessionId: number, records: VectorRecord[]): Promise<void> {
  if (records.length === 0) return
  const conn = await getConnection()
  const name = tableName(sessionId)
  const existing = await conn.tableNames()

  if (existing.includes(name)) {
    const table = await conn.openTable(name)
    await table.add(records)
  } else {
    await conn.createTable(name, records)
  }
}

export async function searchVectors(
  sessionId: number,
  queryVector: number[],
  limit: number,
  timeRange?: { start: number; end: number }
): Promise<VectorRecord[]> {
  const conn = await getConnection()
  const name = tableName(sessionId)
  const existing = await conn.tableNames()
  if (!existing.includes(name)) {
    throw new Error('This session has no ingested data. Please re-ingest the log files for this session.')
  }
  const table = await conn.openTable(name)
  let q = table.search(queryVector).limit(limit)
  if (timeRange) {
    // Include chunks with no timestamp (-1) and chunks whose window overlaps the filter range
    q = q.where(
      `timestamp_start = -1 OR (timestamp_start <= ${timeRange.end} AND timestamp_end >= ${timeRange.start})`
    )
  }
  const results = await q.toArray()
  return results as unknown as VectorRecord[]
}

export async function dropSessionVectors(sessionId: number): Promise<void> {
  const conn = await getConnection()
  const name = tableName(sessionId)
  const existing = await conn.tableNames()
  if (existing.includes(name)) {
    await conn.dropTable(name)
  }
}
