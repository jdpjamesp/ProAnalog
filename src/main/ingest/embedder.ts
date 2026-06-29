import OpenAI from 'openai'
import { getSetting } from '../db/settings'
import type { ProviderConfig } from '../../shared/types'
import type { Chunk, VectorRecord } from './types'

const EMBED_BATCH_SIZE = 100

export async function embedAndPrepare(
  chunks: Chunk[],
  onProgress: (current: number, total: number) => void
): Promise<VectorRecord[]> {
  const config = getSetting<ProviderConfig>('provider')
  if (!config) throw new Error('No LLM provider configured. Add one in Settings before ingesting.')
  if (!config.embedding_model) throw new Error('No embedding model configured in the active provider.')

  const client = new OpenAI({
    apiKey: config.api_key || 'no-key',  // some local providers need a placeholder
    baseURL: config.base_url || undefined,
  })

  const records: VectorRecord[] = []

  for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBED_BATCH_SIZE)

    const response = await client.embeddings.create({
      model: config.embedding_model,
      input: batch.map(c => c.text),
    })

    for (let j = 0; j < batch.length; j++) {
      const chunk = batch[j]
      records.push({
        id: chunk.id,
        vector: response.data[j].embedding,
        text: chunk.text,
        filename: chunk.filename,
        log_type: chunk.logType,
        line_start: chunk.lineStart,
        line_end: chunk.lineEnd,
        timestamp_start: chunk.timestampStart ?? -1,
        timestamp_end: chunk.timestampEnd ?? -1,
      })
    }

    onProgress(Math.min(i + EMBED_BATCH_SIZE, chunks.length), chunks.length)
  }

  return records
}
