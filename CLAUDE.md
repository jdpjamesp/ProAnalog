# ProAnalog — Claude Code Guide

## What this is
Electron desktop app for ingesting OpenEdge ABL log files and interrogating them via LLM/RAG. This is a v2.0 full rewrite — do not reference or carry over any v1 code.

## Stack
- **Electron** + **React** + **TypeScript**
- **better-sqlite3** — session/query/response persistence
- **LanceDB** — local vector storage (one table per session)
- **Electron safeStorage** — encrypted API key storage
- **OpenAI-compatible SDK** — universal LLM client (Anthropic, OpenAI, Groq, Ollama, LM Studio, Azure OpenAI via base URL + API key config)
- **electron-builder** — cross-platform packaging (`.exe`, `.dmg`, `.AppImage`)

## Core constraints
- Fully standalone — no Progress/OpenEdge installation required
- Log parsing is pure regex/string processing in Node.js/TypeScript
- Multi-provider LLM support: user configures base URL, API key, chat model, and embedding model per provider

## UI — Four main areas
1. **Sessions** — browse, name, delete past sessions; click to restore full context and Q&A history
2. **Ingest** — drag-and-drop or file-picker for `.log` files, chunking/processing with progress indicator, session naming
3. **Query** — chat-style interface; follow-up questions reuse existing session embeddings (low token cost)
4. **Settings** — manage LLM providers (label, base URL, API key, chat model, embedding model); global or per-session provider selection; temperature, max tokens

## Data model
- **SQLite**: `sessions`, `queries`, `settings` tables
- **LanceDB**: local directory, one table per session for chunk embeddings

## Out of scope (v2.0)
- VS Code extension
- Any ABL/Progress runtime dependency
