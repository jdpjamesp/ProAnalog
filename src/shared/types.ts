export interface Session {
  id: number
  name: string
  filename: string
  filepath: string
  file_size: number
  chunk_count: number
  created_at: number   // unix ms
  updated_at: number
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
  chunk_size_chars: number
}

// IPC channel names — single source of truth
export const IPC = {
  sessions: {
    list:   'sessions:list',
    get:    'sessions:get',
    create: 'sessions:create',
    rename: 'sessions:rename',
    delete: 'sessions:delete',
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
} as const
