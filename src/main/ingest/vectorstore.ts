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
  limit: number
): Promise<VectorRecord[]> {
  const conn = await getConnection()
  const table = await conn.openTable(tableName(sessionId))
  const results = await table.search(queryVector).limit(limit).toArray()
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
