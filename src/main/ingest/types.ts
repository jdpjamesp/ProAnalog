// ── Internal ingest types (main process only) ─────────────────────────────────

export interface Chunk {
  id: string                    // `${sessionId}:${filename}:${lineStart}`
  sessionId: number
  filename: string
  logType: string
  lineStart: number
  lineEnd: number
  timestampStart: number | null  // epoch ms — null if no parsed timestamps in chunk
  timestampEnd: number | null
  text: string                   // raw log lines joined with \n
}

export interface IngestOptions {
  chunkSize: number        // lines per chunk
  chunkOverlap: number     // lines of overlap between adjacent chunks
  timeRangeStart?: Date    // only ingest lines on or after this time
  timeRangeEnd?: Date      // only ingest lines on or before this time
}

export const DEFAULT_INGEST_OPTIONS: IngestOptions = {
  chunkSize: 50,
  chunkOverlap: 5,
}

/** Record written to LanceDB. snake_case to match SQL conventions for easy filtering. */
export interface VectorRecord {
  id: string
  vector: number[]
  text: string
  filename: string
  log_type: string
  line_start: number
  line_end: number
  timestamp_start: number   // epoch ms, or -1 if no timestamp
  timestamp_end: number     // epoch ms, or -1 if no timestamp
  [key: string]: unknown    // satisfies LanceDB's Record<string, unknown> constraint
}
