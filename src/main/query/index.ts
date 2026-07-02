import OpenAI from 'openai'
import type { WebContents } from 'electron'
import { getSetting } from '../db/settings'
import { createQuery } from '../db/queries'
import { updateSessionUpdatedAt } from '../db/sessions'
import { searchVectors } from '../ingest/vectorstore'
import { embedTexts } from '../embed'
import type { ProviderConfig, QueryConfig, Query, ChunkRef } from '../../shared/types'
import { IPC } from '../../shared/types'
import type { VectorRecord } from '../ingest/types'

const DEFAULT_RETRIEVAL_LIMIT = 12
const DEFAULT_SEARCH_TYPE: QueryConfig['search_type'] = 'exact'

const SYSTEM_PROMPT = `\
You are an expert log analyst for Progress OpenEdge / PASOE (Progress Application Server for OpenEdge) applications.

## Platform context
OpenEdge is a 4GL/ABL application platform from Progress Software. PASOE is its application server, which embeds Apache Tomcat to host ABL web applications and REST services. A typical deployment has:
- One or more OpenEdge databases (each with its own broker process)
- A PASOE instance running on Tomcat, hosting one or more web applications
- ABL agent processes (AS-N, AS-Aux-N) that execute business logic on behalf of HTTP requests
- Java-layer infrastructure managed by Tomcat and the PASOE webapp

## Log types you may encounter
Each log chunk is labelled with its source file and type (e.g. "pasoe-access", "db-log"). Use the type to interpret the format correctly:

**db-log** — OpenEdge database log (.lg file)
Structured entries: [yyyy/mm/dd@hh:mm:ss.uuu±hhmm] P-<pid> T-<tid> <severity> <source>: (<msgnum>) <message>
Severity: I=Informational, W=Warning, F=Fatal. Sources include BROKER (database broker), DBUTIL (utility ops), USR (user sessions), RPLS (replication). Message numbers can be looked up in Progress docs. Section header lines (plain date banners) appear between activity groups and are not log entries.

**pasoe-access** — PASOE HTTP access log (custom Tomcat variant, NOT standard Combined Log Format)
Fields: <client-ip> <user> [<timestamp>] "<method> <path> <protocol>" <status> <bytes> <responseMs> <pasoe-thread> <extra>
The responseMs field is server processing time in milliseconds — useful for identifying slow requests. PASOE threads are named thd-N. The user field is "-" for unauthenticated requests.

**pasoe-app** — PASOE ABL application log
Structured entries: [yy/mm/dd@hh:mm:ss.uuu±hhmm] P-<pid> T-<tid> <level> <agent> <category> [(Procedure: '<name>' Line:<n>)] <message>
Level: 1=standard, 2=verbose. Agents: AS-N (standard workers), AS-Aux-N (auxiliary). Categories: -- (ABL/user code, may include procedure callsite), AS (app server infrastructure), MSAS (multi-server events), CONN (database connection events). Messages prefixed with ** indicate warnings or errors from ABL code.

**catalina** — Tomcat engine log (catalina.out or localhost.YYYY-MM-DD.log)
Fields: DD-Mon-YYYY HH:MM:SS.mmm LEVEL [thread] logger.method message
Covers JVM-level events, webapp lifecycle, Tomcat connector errors. May include Java thread dumps (long blocks with stack frames beginning with "at "). Severity: INFO/DEBUG=informational, WARN=warning, ERROR/SEVERE=fatal.

**pasoe-webapp** — PASOE Java webapp layer log (active.YYYY-MM-DD.log or <webapp>.YYYY-MM-DD.log)
Fields: HH:MM:SS.mmm/<uptimeMs> [thread] LEVEL logger - message
Time only — no date in each line (date comes from filename). Thread names contain base64-style PASOE instance IDs. Logger names are abbreviated Java FQCNs (e.g. c.p.appserv.PoolMgt.AgentWatchdog = com.progress.appserv.PoolMgt.AgentWatchdog). Covers agent pool management, session lifecycle, watchdog events.

## Common issues to recognise
- Lock wait timeouts ("Lock wait timeout of N seconds expired") — contention on database records
- Agent terminations in pasoe-webapp — unexpected agent process deaths, watchdog restarts
- Slow requests in pasoe-access — responseMs significantly above normal baseline
- MSAS session startup/shutdown in pasoe-app — agent pool scaling events
- Fatal (F) entries in db-log — database-level errors, potential crash precursors
- Database connection events (CONN category) — ABL agents connecting/disconnecting from the database

## Instructions
The user has ingested one or more of the above log files into a session. You will be given the most relevant excerpts as context. Answer the user's question concisely and specifically. Cite file names and line numbers where relevant. If the provided context does not contain enough information to answer confidently, say so clearly rather than speculating.`

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

  const queryConfig = getSetting<QueryConfig>('query')
  const retrievalLimit = queryConfig?.retrieval_limit ?? DEFAULT_RETRIEVAL_LIMIT
  const searchType     = queryConfig?.search_type     ?? DEFAULT_SEARCH_TYPE

  const client = new OpenAI({
    apiKey:  config.api_key || 'no-key',
    baseURL: config.base_url || undefined,
    timeout: (config.timeout_seconds ?? 120) * 1000,
  })

  // 1. Embed the question
  const [qVector] = await embedTexts(config, [question])

  // 2. Search LanceDB
  const rawResults = await searchVectors(sessionId, qVector, retrievalLimit, timeRange, searchType)
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
  let tokensUsed = 0

  const stream = await client.chat.completions.create({
    model:       config.chat_model,
    messages:    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user',   content: userContent },
    ],
    temperature:    config.temperature   ?? 0.2,
    max_tokens:     config.max_tokens    ?? 4096,
    stream: true,
    stream_options: { include_usage: true },
  })

  for await (const chunk of stream) {
    const token = chunk.choices[0]?.delta?.content ?? ''
    if (token) {
      fullAnswer += token
      sender.send(IPC.query.token, token)
    }
    if (chunk.usage?.total_tokens) {
      tokensUsed = chunk.usage.total_tokens
    }
  }

  // 5. Persist and update session timestamp
  const query = createQuery({
    session_id:  sessionId,
    question,
    answer:      fullAnswer,
    chunks_used: chunkRefs,
    tokens_used: tokensUsed,
  })

  updateSessionUpdatedAt(sessionId)

  return query
}
