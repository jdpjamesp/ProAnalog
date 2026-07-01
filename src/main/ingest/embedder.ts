import { getSetting } from '../db/settings'
import { embedTexts } from '../embed'
import type { ProviderConfig, IngestConfig } from '../../shared/types'
import type { Chunk, VectorRecord } from './types'

const EMBED_BATCH_SIZE = 100
const DEFAULT_CONCURRENCY = 3

async function runConcurrent<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let next = 0

  async function worker() {
    while (next < tasks.length) {
      const i = next++
      results[i] = await tasks[i]()
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, worker))
  return results
}

export async function embedAndPrepare(
  chunks: Chunk[],
  onProgress: (current: number, total: number) => void
): Promise<VectorRecord[]> {
  const config = getSetting<ProviderConfig>('provider')
  if (!config) throw new Error('No LLM provider configured. Add one in Settings before ingesting.')
  if (!config.embedding_model) throw new Error('No embedding model configured in the active provider.')

  const ingestConfig = getSetting<IngestConfig>('ingest')
  const concurrency = ingestConfig?.embedding_concurrency ?? DEFAULT_CONCURRENCY

  // Split into batches
  const batches: Chunk[][] = []
  for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
    batches.push(chunks.slice(i, i + EMBED_BATCH_SIZE))
  }

  let completed = 0
  const batchResults = await runConcurrent(
    batches.map(batch => async () => {
      const vectors = await embedTexts(config, batch.map(c => c.text))
      completed += batch.length
      onProgress(Math.min(completed, chunks.length), chunks.length)
      return { batch, vectors }
    }),
    concurrency
  )

  const records: VectorRecord[] = []
  for (const { batch, vectors } of batchResults) {
    for (let j = 0; j < batch.length; j++) {
      const chunk = batch[j]
      records.push({
        id: chunk.id,
        vector: vectors[j],
        text: chunk.text,
        filename: chunk.filename,
        log_type: chunk.logType,
        line_start: chunk.lineStart,
        line_end: chunk.lineEnd,
        timestamp_start: chunk.timestampStart ?? -1,
        timestamp_end: chunk.timestampEnd ?? -1,
      })
    }
  }

  return records
}
