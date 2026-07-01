export interface Session {
  id: number
  name: string
  chunk_count: number
  file_count: number
  query_count?: number  // computed via subquery in listSessions
  created_at: number   // unix ms
  updated_at: number
}

export interface SessionFile {
  id: number
  session_id: number
  filename: string
  filepath: string
  file_size: number    // bytes
  log_type: string
  line_count: number
  created_at: number   // unix ms
}

export interface Query {
  id: number
  session_id: number
  question: string
  answer: string
  chunks_used: string  // JSON: ChunkRef[]
  tokens_used: number
  created_at: number
}

export interface ChunkRef {
  chunk_id: string
  line: number
  score: number
  preview: string
}

export interface Setting {
  key: string
  value: string        // JSON-encoded
  updated_at: number
}

export interface ProviderConfig {
  label: string
  base_url: string
  api_key: string
  chat_model: string
  embedding_model: string
  temperature: number
  max_tokens: number
  timeout_seconds: number
}

export interface IngestConfig {
  chunk_size: number          // lines per chunk
  chunk_overlap: number       // overlap lines
  embedding_concurrency: number  // parallel embedding batches
}

/** One file to ingest — renderer sends filepath + optional logType override. */
export interface IngestFileSpec {
  filepath: string
  logType?: string   // undefined = auto-detect; set when user manually picks the type
}

/** Options for a full ingest run — serializable for IPC (no Date objects). */
export interface IngestRunOptions {
  sessionId: number
  files: IngestFileSpec[]
  chunkSize: number
  chunkOverlap: number
  timeRangeStart?: number   // epoch ms
  timeRangeEnd?: number     // epoch ms
}

export type IngestStage = 'parsing' | 'embedding' | 'storing' | 'done'

/** Progress event pushed from main → renderer during an ingest run. */
export interface IngestProgress {
  stage: IngestStage
  current: number
  total: number
  message: string
}

/** Serializable summary returned to the renderer after parsing a log file.
 *  Does not include the full line array — that stays in main for chunking/embedding. */
export interface IngestParseResult {
  logType: string | null   // null if no parser detected the file
  totalLines: number
  parsedEntries: number
  sectionHeaders: number
  unparsedLines: number
  bySource: Record<string, number>
  bySeverity: Record<string, number>
  preview: string[]        // first ~10 raw lines — used in "Report unknown format" issue body
}

// IPC channel names — single source of truth
export const IPC = {
  sessions: {
    list:   'sessions:list',
    get:    'sessions:get',
    create: 'sessions:create',   // { name: string } → Session
    rename: 'sessions:rename',
    delete: 'sessions:delete',
  },
  sessionFiles: {
    list: 'session-files:list',  // (sessionId: number) → SessionFile[]
  },
  queries: {
    list:   'queries:list',
    create: 'queries:create',
  },
  settings: {
    get:    'settings:get',
    set:    'settings:set',
    getAll: 'settings:getAll',
  },
  ingest: {
    parse:    'ingest:parse',     // filepath → IngestParseResult
    run:      'ingest:run',       // IngestRunOptions → void (progress via ingest:progress events)
    progress: 'ingest:progress',  // main → renderer push: IngestProgress
    parsers:  'ingest:parsers',   // () → string[] — registered log type IDs
  },
  query: {
    ask:    'query:ask',     // (sessionId, question) → Query (after full response)
    token:  'query:token',   // main → renderer push: string (streamed token)
    chunks: 'query:chunks',  // main → renderer push: ChunkRef[] (before tokens)
    error:  'query:error',   // main → renderer push: string (error message)
  },
} as const
