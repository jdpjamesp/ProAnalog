import OpenAI from 'openai'
import type { WebContents } from 'electron'
import { getSetting } from '../db/settings'
import { createQuery } from '../db/queries'
import { updateSessionUpdatedAt } from '../db/sessions'
import { searchVectors } from '../ingest/vectorstore'
import { embedTexts } from '../embed'
import type { ProviderConfig, Query, ChunkRef } from '../../shared/types'
import { IPC } from '../../shared/types'
import type { VectorRecord } from '../ingest/types'

const RETRIEVAL_LIMIT = 8

const SYSTEM_PROMPT =
  'You are an expert log analyst for OpenEdge/Progress ABL applications. ' +
  'The user has ingested one or more log files and wants to analyse them. ' +
  'You will be given relevant log excerpts as context. ' +
  'Answer the user\'s question concisely and specifically. ' +
  'Cite file names and line numbers where relevant. ' +
  'If the context does not contain enough information to answer, say so clearly.'

type SearchResult = VectorRecord & { _distance?: number }

export async function askQuestion(
  sender: WebContents,
  sessionId: number,
  question: string,
  timeRange?: { start: number; end: number }
): Promise<Query> {
  const config = getSetting<ProviderConfig>('provider')
  if (!config)               throw new Error('No LLM provider configured — open Settings to add one.')
  if (!config.chat_model)    throw new Error('No chat model configured in the active provider.')
  if (!config.embedding_model) throw new Error('No embedding model configured in the active provider.')

  const client = new OpenAI({
    apiKey:  config.api_key || 'no-key',
    baseURL: config.base_url || undefined,
    timeout: (config.timeout_seconds ?? 120) * 1000,
  })

  // 1. Embed the question
  const [qVector] = await embedTexts(config, [question])

  // 2. Search LanceDB
  const rawResults = await searchVectors(sessionId, qVector, RETRIEVAL_LIMIT, timeRange)
  const results = rawResults as SearchResult[]

  const chunkRefs: ChunkRef[] = results.map(r => ({
    chunk_id: r.id,
    line:     r.line_start,
    // L2 distance between unit vectors is in [0, 2]; map to [1, 0]
    score:    r._distance !== undefined ? Math.max(0, 1 - r._distance / 2) : 0,
    preview:  r.text.split('\n').slice(0, 3).join('\n'),
  }))

  sender.send(IPC.query.chunks, chunkRefs)

  // 3. Build prompt
  const contextBlocks = results
    .map((r, i) =>
      `[${i + 1}] ${r.filename} (${r.log_type}) lines ${r.line_start}–${r.line_end}\n${r.text}`
    )
    .join('\n\n---\n\n')

  const userContent = `${question}\n\n---\nLog context:\n\n${contextBlocks}`

  // 4. Stream LLM response
  let fullAnswer = ''

  const stream = await client.chat.completions.create({
    model:       config.chat_model,
    messages:    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: userContent },
    ],
    temperature:    config.temperature   ?? 0.2,
    max_tokens:     config.max_tokens    ?? 4096,
    stream: true,
  })

  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content ?? ''
    if (token) {
      fullAnswer += token
      sender.send(IPC.query.token, token)
    }
  }

  // 5. Persist and update session timestamp
  const query = createQuery({
    session_id:  sessionId,
    question,
    answer:      fullAnswer,
    chunks_used: chunkRefs,
    tokens_used: 0,
  })

  updateSessionUpdatedAt(sessionId)

  return query
}
