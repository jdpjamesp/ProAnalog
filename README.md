# ProAnalog

A desktop application for ingesting OpenEdge ABL log files and interrogating them via LLM and RAG (retrieval-augmented generation).

Built with Electron, React, and TypeScript. Fully standalone — no Progress/OpenEdge installation required.

---

## What it does

ProAnalog lets you load one or more OpenEdge log files into a local vector database, then ask plain-English questions about them. The app finds the most relevant log excerpts and sends them as context to your configured LLM, streaming the answer back in a chat interface.

Typical use cases:

- "What errors occurred between 09:00 and 09:30?"
- "Are there any lock timeout or deadlock events?"
- "Which ABL procedures are appearing most often in the app log?"
- "Summarise the PASOE activity for this session."

---

## Supported log formats

| Log type | File pattern | Parser ID |
|---|---|---|
| OpenEdge database log | `*.lg` | `db-log` |
| PASOE access log (Tomcat Combined) | `access_log*.txt` | `pasoe-access` |
| PASOE application log | `*.log` (agent format) | `pasoe-app` |
| Tomcat Catalina log | `catalina.out`, `localhost.YYYY-MM-DD.log` | `catalina` |
| PASOE webapp log (logback) | `active.YYYY-MM-DD.log` | `pasoe-webapp` |

A single session can contain multiple files of different types. All are chunked and embedded into the same vector table so the LLM has combined context.

If a file is not recognised automatically, the app presents a manual type selector and a "Report" button that opens a pre-filled GitHub issue with the file's extension and first lines.

---

## Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 42 |
| UI | React 19 + TypeScript |
| Local DB | better-sqlite3 (sessions, queries, settings) |
| Vector store | LanceDB (one table per session) |
| LLM client | OpenAI-compatible SDK (works with any provider) |
| Packaging | electron-builder |

---

## LLM provider support

ProAnalog uses an OpenAI-compatible HTTP client, so it works with any provider that exposes that API surface:

- **Anthropic** (via compatible endpoint)
- **OpenAI** — GPT-4o, GPT-4.1, etc.
- **Groq**
- **Ollama** — local models
- **LM Studio** — local models
- **Azure OpenAI**

Configure your provider in Settings: base URL, API key, chat model, and embedding model. The API key is stored encrypted using Electron's `safeStorage`.

---

## Views

### Sessions
Lists all past analysis sessions sorted by last activity. Each session shows its file count, chunk count, query count, and date. Click a session to restore it and go straight to Query. Sessions can be renamed inline or deleted via the hover buttons or right-click context menu.

### Ingest
Drag and drop log files (or use the file picker) to start a new session. Each file is parsed immediately on drop and a type badge confirms detection. Unknown formats show a type selector. Once all files are identified, name the session and click **Start ingestion** — the app chunks the log lines, calls the configured embedding model in batches, and stores the vectors locally. Progress is shown in real time.

### Query
Chat interface for interrogating the active session. Each question is embedded, the closest chunks are retrieved from LanceDB, and the full context is sent to the LLM. Responses stream token by token. The right-hand sidebar shows:

- **Time filter** — From/To pickers pre-populated with the actual date/time range of the ingested logs, so you can immediately narrow to a specific window without consulting the raw files. Chunks with no timestamp are always included regardless of the filter. When a time filter is set, *every* chunk in that window is sent to the LLM, even if that exceeds the retrieval limit setting below — the filter is treated as an explicit request for the whole window, not just the top-K most similar chunks.
- **Session stats** — file count, chunk count, query count, and a Coverage line showing the overall time span of the logs.
- **Retrieved chunks** — the specific excerpts used for the last answer, with relevance scores.
- **Token usage** — tokens used for the last query and the running session total.

Follow-up questions reuse the existing embeddings — no re-ingestion needed.

Querying is disabled while a session is actively being ingested (input and send button are greyed out with an explanatory message) to avoid running against incomplete embeddings — ingestion continues in the background if you switch away from the Ingest tab, so just wait for it to finish.

### Settings
Three configuration sections:

**LLM Provider** — base URL, API key, chat model, embedding model, temperature, max tokens, and timeout. The API key is stored encrypted.

**Ingestion** — controls how log files are chunked before embedding:
- *Chunk size* — lines per chunk (default 50). Smaller = more precise embeddings, more chunks.
- *Chunk overlap* — lines shared between adjacent chunks (default 15). Higher values prevent log events from being split across chunk boundaries. Range: 10–20.
- *Embedding concurrency* — parallel batches during ingest (Ollama/local: 5–10, OpenAI: 3–5, Groq: 2–4, Google free tier: 1–2).

**Query & Retrieval** — controls how context is fetched at query time:
- *Search type* — **Exact** (default) scans all vectors for a deterministic result; the same question always retrieves the same chunks. **Approximate** uses an ANN index, which is faster on very large datasets but may return different chunks on repeated queries.
- *Retrieval limit* — number of chunks sent to the LLM per query (default 12). Higher values give more context but use more tokens. Range: 8–20.

---

## Development

```bash
npm install
npm run dev
```

Requires Node.js 20+. The `postinstall` script rebuilds `better-sqlite3` against the Electron runtime automatically.

```bash
npm run typecheck   # TypeScript check (main + renderer)
npm run build       # Production build
npm run dist:win    # Windows installer (.exe / NSIS)
npm run dist:mac    # macOS disk image (.dmg)
npm run dist:linux  # Linux AppImage
```

---

## Data storage

All data is stored locally on your machine:

- **SQLite database** — `%APPDATA%\ProAnalog\proanalog.db` (Windows) — sessions, queries, settings
- **Vector store** — `%APPDATA%\ProAnalog\lancedb\` — one table per session
- **API key** — encrypted via Electron `safeStorage`, stored in the OS credential store

No data is sent anywhere except the LLM provider API calls you configure.

---

## Privacy

Log files can contain sensitive information (customer names, emails, transaction data). The ingest screen displays a reminder not to upload files containing personal or sensitive data. Only the chunks most relevant to your question are sent to the LLM — raw log lines are never uploaded in their entirety.
