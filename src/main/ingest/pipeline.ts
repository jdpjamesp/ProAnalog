import { readFile, stat } from 'fs/promises'
import { basename } from 'path'
import { detectParser, getParser } from '../parser'
import { updateSessionChunkCount, addSessionFile, updateSessionTimestampRange } from '../db/sessions'
import { chunkLines } from './chunker'
import { embedAndPrepare } from './embedder'
import { storeVectors } from './vectorstore'
import type { IngestOptions } from './types'
import type { IngestProgress, IngestFileSpec } from '../../shared/types'

const SNIFF_BYTES = 2048

export async function runIngestPipeline(
  sessionId: number,
  files: IngestFileSpec[],
  options: IngestOptions,
  onProgress: (progress: IngestProgress) => void
): Promise<void> {
  const allChunks: ReturnType<typeof chunkLines> = []

  // ── Parse + chunk each file ──────────────────────────────────────────────
  for (let fi = 0; fi < files.length; fi++) {
    const { filepath, logType } = files[fi]
    const filename = basename(filepath)

    onProgress({
      stage: 'parsing',
      current: fi + 1,
      total: files.length,
      message: `Parsing ${filename}…`,
    })

    const [content, fileStat] = await Promise.all([
      readFile(filepath, 'utf-8'),
      stat(filepath),
    ])
    const parser = logType
      ? getParser(logType)
      : detectParser(filename, content.slice(0, SNIFF_BYTES))

    if (!parser) throw new Error(`Could not identify log format for "${filename}". Select the type manually and retry.`)

    const result = parser.parse(content)
    const chunks = chunkLines(result.lines, sessionId, filename, result.logType, options)
    allChunks.push(...chunks)

    addSessionFile({
      session_id: sessionId,
      filename,
      filepath,
      file_size: fileStat.size,
      log_type: result.logType,
      line_count: result.stats.totalLines,
    })
  }

  if (allChunks.length === 0) {
    onProgress({ stage: 'done', current: 0, total: 0, message: 'No content to embed after filtering.' })
    return
  }

  // ── Embed ────────────────────────────────────────────────────────────────
  onProgress({ stage: 'embedding', current: 0, total: allChunks.length, message: 'Starting embedding…' })

  const records = await embedAndPrepare(allChunks, (current, total) => {
    onProgress({ stage: 'embedding', current, total, message: `Embedding ${current} / ${total} chunks…` })
  })

  // ── Store in LanceDB ─────────────────────────────────────────────────────
  onProgress({ stage: 'storing', current: 0, total: records.length, message: 'Storing vectors…' })
  await storeVectors(sessionId, records)

  // ── Update session chunk count and timestamp range in SQLite ────────────
  updateSessionChunkCount(sessionId, records.length)

  const starts = allChunks.map(c => c.timestampStart).filter((t): t is number => t !== null)
  const ends   = allChunks.map(c => c.timestampEnd).filter((t): t is number => t !== null)
  const tsMin  = starts.length > 0 ? Math.min(...starts) : null
  const tsMax  = ends.length   > 0 ? Math.max(...ends)   : null
  updateSessionTimestampRange(sessionId, tsMin, tsMax)

  onProgress({ stage: 'done', current: records.length, total: records.length, message: `Done — ${records.length} chunks stored.` })
}
