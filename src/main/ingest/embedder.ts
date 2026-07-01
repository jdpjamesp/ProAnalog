import { getSetting } from '../db/settings'
import { embedTexts } from '../embed'
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

  const records: VectorRecord[] = []

  for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBED_BATCH_SIZE)
    const vectors = await embedTexts(config, batch.map(c => c.text))

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

    onProgress(Math.min(i + EMBED_BATCH_SIZE, chunks.length), chunks.length)
  }

  return records
}
