import React, { useState, useRef, useEffect } from 'react'
import type { ProviderConfig, IngestConfig, Session, Query, ChunkRef, IngestProgress, IngestParseResult } from '../../shared/types'
import './styles.css'

type View = 'sessions' | 'ingest' | 'query' | 'settings'

export default function App(): React.JSX.Element {
  const [view, setView]                   = useState<View>('sessions')
  const [activeSession, setActiveSession] = useState<Session | null>(null)
  const [sessionCount, setSessionCount]   = useState(0)

  useEffect(() => {
    window.api.sessions.list().then(s => setSessionCount(s.length))
  }, [])

  const handleSessionCreated = (s: Session) => {
    setActiveSession(s)
    setSessionCount(c => c + 1)
  }

  return (
    <div style={shell}>
      <Titlebar activeSession={activeSession} />
      <Sidebar view={view} onNavigate={setView} activeSession={activeSession} sessionCount={sessionCount} />
      <main style={mainStyle}>
        {view === 'sessions'  && <SessionsView onSessionSelect={(s) => { setActiveSession(s); setView('query') }} onNavigate={setView} onSessionDeleted={() => setSessionCount(c => c - 1)} />}
        {view === 'ingest'    && <IngestView onNavigate={setView} onSessionCreated={handleSessionCreated} />}
        {view === 'query'     && <QueryView activeSession={activeSession} onNavigate={setView} />}
        {view === 'settings'  && <SettingsView />}
      </main>
    </div>
  )
}

/* ── Shell layout ──────────────────────────────────────────────────────── */
const shell: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '220px 1fr',
  gridTemplateRows: '48px 1fr',
  height: '100vh',
  overflow: 'hidden',
}
const mainStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  background: 'var(--bg-base)',
}

/* ── Titlebar ──────────────────────────────────────────────────────────── */
function Titlebar({ activeSession }: { activeSession: Session | null }) {
  return (
    <header style={{
      gridColumn: '1 / -1',
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 1rem',
      gap: '0.75rem',
      WebkitAppRegion: 'drag',
      userSelect: 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: 15, letterSpacing: '0.02em' }}>
        <div style={{
          width: 24, height: 24,
          background: 'linear-gradient(135deg, var(--accent) 0%, #a855f7 100%)',
          borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 700, color: '#fff', flexShrink: 0,
        }}>PA</div>
        ProAnalog
      </div>

      <div style={{
        marginLeft: '0.5rem', padding: '3px 10px',
        background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 4,
        color: 'var(--text-2)', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: activeSession ? 'var(--teal)' : 'var(--text-3)', display: 'inline-block' }} />
        {activeSession ? activeSession.name : 'No session loaded'}
      </div>

      <div style={{ flex: 1 }} />

      <StatusChip label="No provider" ok={false} />
    </header>
  )
}

function StatusChip({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      padding: '2px 8px',
      background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 20,
      fontSize: 11, color: 'var(--text-2)',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: ok ? 'var(--teal)' : 'var(--text-3)', display: 'inline-block' }} />
      {label}
    </div>
  )
}

/* ── Sidebar ───────────────────────────────────────────────────────────── */
function Sidebar({ view, onNavigate, activeSession, sessionCount }: { view: View; onNavigate: (v: View) => void; activeSession: Session | null; sessionCount: number }) {
  return (
    <aside style={{
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      padding: '0.75rem 0',
      overflowY: 'auto',
    }}>
      <NavSection label="Analysis">
        <NavItem icon="⊞" label="Sessions"  active={view === 'sessions'}  onClick={() => onNavigate('sessions')} badge={String(sessionCount)} />
        <NavItem icon="↑" label="Ingest"    active={view === 'ingest'}    onClick={() => onNavigate('ingest')} />
        <NavItem icon="◈" label="Query"     active={view === 'query'}     onClick={() => onNavigate('query')} />
      </NavSection>

      <Divider />

      <NavSection label="Recent Sessions">
        <div style={{ padding: '0.25rem 0.5rem', color: 'var(--text-3)', fontSize: 12, textAlign: 'center' }}>
          No sessions yet
        </div>
      </NavSection>

      <Divider />

      <NavSection label="">
        <NavItem icon="⚙" label="Settings" active={view === 'settings'} onClick={() => onNavigate('settings')} />
      </NavSection>

      <div style={{ marginTop: 'auto', padding: '0.75rem 1rem', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-3)' }}>
        <span style={{ display: 'block' }}>ProAnalog v2.0</span>
        {activeSession && (
          <span style={{ display: 'block', marginTop: 2, color: 'var(--teal)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {activeSession.name}
          </span>
        )}
      </div>
    </aside>
  )
}

function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '0 0.5rem', marginBottom: '0.25rem' }}>
      {label && (
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', padding: '0.5rem 0.75rem 0.25rem' }}>
          {label}
        </div>
      )}
      {children}
    </div>
  )
}

function NavItem({ icon, label, active, onClick, badge }: {
  icon: string; label: string; active: boolean; onClick: () => void; badge?: string
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '0.625rem',
        padding: '0.5rem 0.75rem', borderRadius: 6, cursor: 'pointer',
        color: active ? 'var(--accent-text)' : hovered ? 'var(--text-1)' : 'var(--text-2)',
        background: active ? 'var(--accent-glow)' : hovered ? 'var(--bg-hover)' : 'transparent',
        fontWeight: active ? 500 : 400, fontSize: 13.5,
        transition: 'background 0.12s, color 0.12s',
      }}
    >
      <span style={{ width: 16, textAlign: 'center', fontSize: 15, flexShrink: 0, color: active ? 'var(--accent)' : 'inherit' }}>{icon}</span>
      {label}
      {badge !== undefined && (
        <span style={{ marginLeft: 'auto', background: 'var(--accent-dim)', color: 'var(--accent-text)', fontSize: 10, padding: '1px 6px', borderRadius: 10, fontWeight: 600 }}>
          {badge}
        </span>
      )}
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--border)', margin: '0.5rem 1rem' }} />
}

/* ── Panel header ──────────────────────────────────────────────────────── */
function PanelHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '0.75rem',
      padding: '0.875rem 1.25rem',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg-surface)', flexShrink: 0,
    }}>
      <div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{subtitle}</div>}
      </div>
      <div style={{ flex: 1 }} />
      {children}
    </div>
  )
}

function Btn({ variant = 'ghost', children, onClick, disabled }: {
  variant?: 'primary' | 'ghost'; children: React.ReactNode; onClick?: () => void; disabled?: boolean
}) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => !disabled && setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '5px 12px', borderRadius: 5, fontSize: 12, fontWeight: 500,
        border: '1px solid transparent', transition: 'all 0.12s',
        background: variant === 'primary'
          ? (hovered && !disabled ? '#6d28d9' : 'var(--accent)')
          : (hovered ? 'var(--bg-hover)' : 'transparent'),
        color: variant === 'primary' ? '#fff' : hovered ? 'var(--text-1)' : 'var(--text-2)',
        borderColor: variant === 'primary' ? 'var(--accent)' : 'var(--border)',
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >{children}</button>
  )
}

/* ── Sessions view ─────────────────────────────────────────────────────── */
function SessionsView({ onSessionSelect, onNavigate, onSessionDeleted }: {
  onSessionSelect: (s: Session) => void
  onNavigate: (v: View) => void
  onSessionDeleted?: () => void
}) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading]   = useState(true)
  const [renamingId, setRenamingId] = useState<number | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [ctxMenu, setCtxMenu] = useState<{ id: number; x: number; y: number } | null>(null)

  useEffect(() => {
    window.api.sessions.list().then(s => { setSessions(s); setLoading(false) })
  }, [])

  const commitRename = async (id: number) => {
    const trimmed = renameValue.trim()
    if (trimmed) {
      await window.api.sessions.rename(id, trimmed)
      setSessions(prev => prev.map(s => s.id === id ? { ...s, name: trimmed } : s))
    }
    setRenamingId(null)
  }

  const doDelete = async (id: number) => {
    await window.api.sessions.delete(id)
    setSessions(prev => prev.filter(s => s.id !== id))
    onSessionDeleted?.()
  }

  const deleteSession = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation()
    await doDelete(id)
  }

  const header = (
    <PanelHeader title="Sessions" subtitle="Past log analysis sessions">
      <Btn variant="primary" onClick={() => onNavigate('ingest')}>＋ New session</Btn>
    </PanelHeader>
  )

  if (loading) {
    return (
      <>
        {header}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)' }}>
          Loading…
        </div>
      </>
    )
  }

  return (
    <>
      {header}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
        {sessions.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '0.75rem', color: 'var(--text-3)' }}>
            <div style={{ fontSize: 32, opacity: 0.3 }}>⊞</div>
            <div>No sessions yet — ingest a log file to get started</div>
            <Btn variant="primary" onClick={() => onNavigate('ingest')}>Ingest →</Btn>
          </div>
        ) : sessions.map(s => (
          <SessionCard
            key={s.id}
            session={s}
            isRenaming={renamingId === s.id}
            renameValue={renameValue}
            onRenameValueChange={setRenameValue}
            onRenameStart={() => { setRenamingId(s.id); setRenameValue(s.name) }}
            onRenameCommit={() => commitRename(s.id)}
            onRenameCancel={() => setRenamingId(null)}
            onSelect={() => onSessionSelect(s)}
            onDelete={(e) => deleteSession(e, s.id)}
            onContextMenu={(e) => { e.preventDefault(); setCtxMenu({ id: s.id, x: e.clientX, y: e.clientY }) }}
          />
        ))}

        {ctxMenu && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setCtxMenu(null)} />
            <div style={{
              position: 'fixed', zIndex: 100, left: ctxMenu.x, top: ctxMenu.y,
              background: 'var(--bg-panel)', border: '1px solid var(--border)',
              borderRadius: 6, boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
              minWidth: 130, overflow: 'hidden',
            }}>
              <CtxMenuItem label="Rename" onClick={() => {
                const s = sessions.find(s => s.id === ctxMenu.id)
                if (s) { setRenamingId(s.id); setRenameValue(s.name) }
                setCtxMenu(null)
              }} />
              <CtxMenuItem label="Delete" danger onClick={() => { doDelete(ctxMenu.id); setCtxMenu(null) }} />
            </div>
          </>
        )}
      </div>
    </>
  )
}

function CtxMenuItem({ label, onClick, danger }: { label: string; onClick: () => void; danger?: boolean }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        background: hovered ? 'var(--bg-hover)' : 'none',
        border: 'none', padding: '7px 14px', fontSize: 13,
        color: danger ? 'var(--red)' : 'var(--text-1)',
        cursor: 'pointer',
      }}
    >{label}</button>
  )
}

function SessionCard({ session, isRenaming, renameValue, onRenameValueChange, onRenameStart, onRenameCommit, onRenameCancel, onSelect, onDelete, onContextMenu }: {
  session: Session
  isRenaming: boolean
  renameValue: string
  onRenameValueChange: (v: string) => void
  onRenameStart: () => void
  onRenameCommit: () => void
  onRenameCancel: () => void
  onSelect: () => void
  onDelete: (e: React.MouseEvent) => void
  onContextMenu?: (e: React.MouseEvent) => void
}) {
  const [hovered, setHovered] = useState(false)
  const date = new Date(session.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

  return (
    <div
      onClick={isRenaming ? undefined : onSelect}
      onContextMenu={onContextMenu}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--bg-panel)',
        border: `1px solid ${hovered && !isRenaming ? 'var(--border-light)' : 'var(--border)'}`,
        borderRadius: 8, padding: '0.875rem 1rem',
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        cursor: isRenaming ? 'default' : 'pointer',
        transition: 'border-color 0.12s',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        {isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={e => onRenameValueChange(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onRenameCommit(); if (e.key === 'Escape') onRenameCancel() }}
            onBlur={onRenameCommit}
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'var(--bg-input)', border: '1px solid var(--accent)', borderRadius: 5,
              color: 'var(--text-1)', fontFamily: 'var(--font)', fontSize: 13.5,
              padding: '3px 7px', outline: 'none',
            }}
          />
        ) : (
          <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {session.name}
          </div>
        )}
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span>{session.file_count} {session.file_count === 1 ? 'file' : 'files'}</span>
          <span>{session.chunk_count.toLocaleString()} chunks</span>
          {(session.query_count ?? 0) > 0 && (
            <span>{session.query_count} {session.query_count === 1 ? 'query' : 'queries'}</span>
          )}
          <span style={{ marginLeft: 'auto' }}>{date}</span>
        </div>
      </div>

      {hovered && !isRenaming && (
        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button
            onClick={e => { e.stopPropagation(); onRenameStart() }}
            style={{ background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text-2)', fontSize: 11, padding: '3px 8px', cursor: 'pointer' }}
          >Rename</button>
          <button
            onClick={onDelete}
            style={{ background: 'none', border: '1px solid transparent', borderRadius: 5, color: 'var(--text-3)', fontSize: 13, padding: '2px 7px', cursor: 'pointer' }}
          >✕</button>
        </div>
      )}
    </div>
  )
}

/* ── Ingest view ───────────────────────────────────────────────────────── */
type IngestPhase = 'idle' | 'ingesting' | 'done'

interface FileEntry {
  id: string
  path: string
  name: string
  parseResult: IngestParseResult | null
  logTypeOverride: string | undefined
  parsing: boolean
  error: string | null
}

function IngestView({ onNavigate, onSessionCreated }: {
  onNavigate: (v: View) => void
  onSessionCreated: (s: Session) => void
}) {
  const [files, setFiles]                   = useState<FileEntry[]>([])
  const [sessionName, setSessionName]       = useState('')
  const [phase, setPhase]                   = useState<IngestPhase>('idle')
  const [progress, setProgress]             = useState<IngestProgress | null>(null)
  const [ingestError, setIngestError]       = useState<string | null>(null)
  const [availableParsers, setAvailableParsers] = useState<string[]>([])
  const [dragging, setDragging]             = useState(false)
  const fileInputRef                        = useRef<HTMLInputElement>(null)

  useEffect(() => {
    window.api.ingest.parsers().then(setAvailableParsers)
  }, [])

  const addFiles = async (paths: string[]) => {
    const fresh = paths.filter(p => !files.some(f => f.path === p))
    if (fresh.length === 0) return

    const entries: FileEntry[] = fresh.map(p => ({
      id: Math.random().toString(36).slice(2),
      path: p,
      name: p.split(/[\\/]/).pop() ?? p,
      parseResult: null,
      logTypeOverride: undefined,
      parsing: true,
      error: null,
    }))

    setFiles(prev => [...prev, ...entries])

    if (!sessionName && entries[0]) {
      const stem = entries[0].name.replace(/\.[^.]+$/, '')
      const date = new Date().toISOString().slice(0, 10)
      setSessionName(`${date} — ${stem}`)
    }

    for (const entry of entries) {
      try {
        const result = await window.api.ingest.parse(entry.path)
        setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, parseResult: result, parsing: false } : f))
      } catch (e) {
        setFiles(prev => prev.map(f => f.id === entry.id ? { ...f, parsing: false, error: String(e) } : f))
      }
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    addFiles(Array.from(e.dataTransfer.files).map(f => window.api.getFilePath(f)))
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(Array.from(e.target.files ?? []).map(f => window.api.getFilePath(f)))
    e.target.value = ''
  }

  const reportUnknown = (file: FileEntry) => {
    const ext  = file.name.includes('.') ? `.${file.name.split('.').pop()}` : '(no extension)'
    const body = `**File extension:** \`${ext}\`\n\n**First lines:**\n\`\`\`\n${(file.parseResult?.preview ?? []).join('\n')}\n\`\`\``
    const url  = `https://github.com/your-org/ProAnalog/issues/new?title=${encodeURIComponent(`Unknown log format: ${ext}`)}&body=${encodeURIComponent(body)}`
    window.api.shell.openExternal(url)
  }

  const startIngest = async () => {
    const readyFiles = files.filter(f => f.parseResult?.logType || f.logTypeOverride)
    if (!readyFiles.length) return

    setPhase('ingesting')
    setProgress(null)
    setIngestError(null)

    const unsub = window.api.ingest.onProgress(p => {
      setProgress(p)
      if (p.stage === 'done') { setPhase('done'); unsub() }
    })

    try {
      const ingestCfg = await window.api.settings.getIngest()
      const session   = await window.api.sessions.create({ name: sessionName.trim() || 'Unnamed session' })
      onSessionCreated(session)

      await window.api.ingest.run({
        sessionId:    session.id,
        files:        readyFiles.map(f => ({
          filepath: f.path,
          logType:  f.logTypeOverride ?? f.parseResult?.logType ?? undefined,
        })),
        chunkSize:    ingestCfg?.chunk_size    ?? 50,
        chunkOverlap: ingestCfg?.chunk_overlap ?? 5,
      })
    } catch (err) {
      unsub()
      setPhase('idle')
      setIngestError(err instanceof Error ? err.message : String(err))
    }
  }

  const allParsed  = files.length > 0 && files.every(f => !f.parsing && !f.error)
  const allKnown   = allParsed && files.every(f => f.parseResult?.logType || f.logTypeOverride)
  const canIngest  = allKnown && phase === 'idle'

  return (
    <>
      <PanelHeader title="Ingest" subtitle="Load log files to create a new analysis session" />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Drop zone — only in idle phase */}
        {phase === 'idle' && (
          <>
            <input ref={fileInputRef} type="file" multiple style={{ display: 'none' }} onChange={handleFileInput} />
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border-light)'}`,
                borderRadius: 12,
                background: dragging ? 'var(--accent-glow)' : 'var(--bg-panel)',
                padding: files.length ? '1.25rem' : '3rem',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.625rem',
                transition: 'all 0.15s', cursor: 'pointer', flexShrink: 0,
              }}
            >
              <div style={{ fontSize: files.length ? 22 : 40, opacity: dragging ? 1 : 0.4 }}>↑</div>
              <div style={{ fontSize: 13.5, color: 'var(--text-1)' }}>
                {files.length ? 'Drop more files or click to browse' : 'Drop log files here'}
              </div>
              {!files.length && <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
                Supports <code style={{ fontFamily: 'var(--mono)', background: 'var(--bg-hover)', padding: '1px 5px', borderRadius: 3, color: 'var(--teal)' }}>.lg</code>{' '}
                <code style={{ fontFamily: 'var(--mono)', background: 'var(--bg-hover)', padding: '1px 5px', borderRadius: 3, color: 'var(--teal)' }}>.log</code>{' '}
                and other OpenEdge log formats — or click to browse
              </div>}
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-3)', marginTop: '-0.5rem', flexShrink: 0 }}>
              ⚠ Do not upload files containing personal or sensitive information (customer names, emails, or other PII).
            </p>
          </>
        )}

        {/* File list */}
        {files.length > 0 && (
          <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
            {files.map((file, i) => (
              <div key={file.id} style={{
                display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.625rem 0.875rem',
                borderTop: i === 0 ? 'none' : '1px solid var(--border)',
                opacity: phase !== 'idle' ? 0.6 : 1,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.name}
                  </div>
                  {file.parseResult && (
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                      {file.parseResult.totalLines.toLocaleString()} lines
                      {file.parseResult.parsedEntries > 0 && ` · ${file.parseResult.parsedEntries.toLocaleString()} entries`}
                    </div>
                  )}
                  {file.parsing && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>Parsing…</div>}
                  {file.error   && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 2 }}>{file.error}</div>}
                </div>

                {/* Type badge / picker */}
                {file.parsing ? null : file.parseResult?.logType || file.logTypeOverride ? (
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                    background: 'var(--teal-dim)', color: 'var(--teal)', whiteSpace: 'nowrap',
                  }}>
                    {file.logTypeOverride ?? file.parseResult?.logType}
                  </span>
                ) : file.parseResult ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    <select
                      value={file.logTypeOverride ?? ''}
                      onChange={(e) => setFiles(prev => prev.map(f => f.id === file.id ? { ...f, logTypeOverride: e.target.value || undefined } : f))}
                      style={{
                        background: 'var(--bg-input)', border: '1px solid var(--amber)', borderRadius: 5,
                        color: 'var(--text-1)', fontSize: 11, padding: '3px 6px', cursor: 'pointer',
                      }}
                    >
                      <option value="">Unknown format…</option>
                      {availableParsers.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <button
                      onClick={() => reportUnknown(file)}
                      title="Report unknown format — opens a pre-filled GitHub issue"
                      style={{
                        background: 'none', border: '1px solid var(--border)', borderRadius: 5,
                        color: 'var(--text-3)', fontSize: 10, padding: '3px 7px', cursor: 'pointer',
                      }}
                    >Report</button>
                  </div>
                ) : null}

                {/* Remove button */}
                {phase === 'idle' && (
                  <button
                    onClick={() => setFiles(prev => prev.filter(f => f.id !== file.id))}
                    style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 16, padding: '0 4px', lineHeight: 1 }}
                  >×</button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Session name + start */}
        {files.length > 0 && phase === 'idle' && (
          <>
            <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.875rem 1rem', flexShrink: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: '0.5rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Session name</div>
              <input
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="e.g. prod-app-server-2026-06-29"
                style={{
                  width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)',
                  borderRadius: 6, padding: '7px 10px', color: 'var(--text-1)',
                  fontFamily: 'var(--font)', fontSize: 13.5, outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            {!allKnown && allParsed && (
              <p style={{ fontSize: 12, color: 'var(--amber)', margin: 0, flexShrink: 0 }}>
                One or more files have an unknown format — select a type or remove them to continue.
              </p>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', flexShrink: 0 }}>
              <Btn variant="primary" onClick={startIngest} disabled={!canIngest}>
                Start ingestion →
              </Btn>
            </div>
          </>
        )}

        {/* Error */}
        {ingestError && phase === 'idle' && (
          <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--red)', borderRadius: 8, padding: '1.25rem', flexShrink: 0 }}>
            <div style={{ color: 'var(--red)', fontSize: 14, fontWeight: 600, marginBottom: '0.5rem' }}>✕ Ingestion failed</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', wordBreak: 'break-word' }}>{ingestError}</div>
          </div>
        )}

        {/* Progress */}
        {phase === 'ingesting' && (
          <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 8, padding: '1.25rem', flexShrink: 0 }}>
            <div style={{ fontSize: 13, color: 'var(--text-1)', marginBottom: '0.75rem' }}>
              {progress?.message ?? 'Starting…'}
            </div>
            <div style={{ background: 'var(--bg-hover)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4, background: 'var(--teal)', transition: 'width 0.3s ease',
                width: progress && progress.total > 0 ? `${(progress.current / progress.total) * 100}%` : '0%',
              }} />
            </div>
            {progress && progress.total > 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: '0.5rem' }}>
                {progress.current.toLocaleString()} / {progress.total.toLocaleString()}
              </div>
            )}
          </div>
        )}

        {/* Done */}
        {phase === 'done' && progress && (
          <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 8, padding: '1.25rem', flexShrink: 0 }}>
            <div style={{ color: 'var(--teal)', fontSize: 14, fontWeight: 600, marginBottom: '0.5rem' }}>✓ Ingestion complete</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: '1rem' }}>{progress.message}</div>
            <Btn variant="primary" onClick={() => onNavigate('query')}>Go to Query →</Btn>
          </div>
        )}

      </div>
    </>
  )
}

/* ── Query view ────────────────────────────────────────────────────────── */
interface Message {
  id: string
  role: 'user' | 'ai'
  text: string
  streaming?: boolean
}

function QueryView({ activeSession, onNavigate }: {
  activeSession: Session | null
  onNavigate: (v: View) => void
}) {
  const [messages, setMessages]               = useState<Message[]>([])
  const [input, setInput]                     = useState('')
  const [sending, setSending]                 = useState(false)
  const [latestChunks, setLatestChunks]       = useState<ChunkRef[]>([])
  const [lastQueryTokens, setLastQueryTokens] = useState(0)
  const [sessionTotalTokens, setSessionTotalTokens] = useState(0)
  const [queryCount, setQueryCount]           = useState(0)
  const [timeFrom, setTimeFrom]               = useState('')
  const [timeTo, setTimeTo]                   = useState('')
  const textareaRef                           = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef                        = useRef<HTMLDivElement>(null)

  // Load history when session changes
  useEffect(() => {
    if (!activeSession) { setMessages([]); return }
    window.api.queries.list(activeSession.id).then((qs: Query[]) => {
      const msgs: Message[] = []
      for (const q of qs) {
        msgs.push({ id: `q-${q.id}`, role: 'user', text: q.question })
        msgs.push({ id: `a-${q.id}`, role: 'ai',   text: q.answer })
      }
      setMessages(msgs)
      setSessionTotalTokens(qs.reduce((sum, q) => sum + q.tokens_used, 0))
      setQueryCount(qs.length)
      setLatestChunks([])
      setLastQueryTokens(0)
    })
  }, [activeSession?.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [input])

  const sendMessage = async () => {
    if (!activeSession || !input.trim() || sending) return
    const question = input.trim()
    setInput('')
    setSending(true)

    const aiMsgId = `ai-${Date.now()}`
    setMessages(prev => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', text: question },
      { id: aiMsgId,           role: 'ai',   text: '', streaming: true },
    ])

    const unsubChunks = window.api.query.onChunks((c: ChunkRef[]) => setLatestChunks(c))
    const unsubToken  = window.api.query.onToken((t: string) =>
      setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: m.text + t } : m))
    )
    const unsubError  = window.api.query.onError((err: string) =>
      setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, text: `Error: ${err}`, streaming: false } : m))
    )

    const timeRangeStart = timeFrom ? new Date(timeFrom).getTime() : undefined
    const timeRangeEnd   = timeTo   ? new Date(timeTo).getTime()   : undefined

    try {
      const q: Query = await window.api.query.ask(activeSession.id, question, timeRangeStart, timeRangeEnd)
      setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, streaming: false } : m))
      setLastQueryTokens(q.tokens_used)
      setSessionTotalTokens(prev => prev + q.tokens_used)
      setQueryCount(prev => prev + 1)
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === aiMsgId && m.streaming ? { ...m, streaming: false } : m
      ))
    } finally {
      unsubChunks(); unsubToken(); unsubError()
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const canSend = !!activeSession && !sending && !!input.trim()

  return (
    <>
      <PanelHeader title="Query" subtitle={activeSession ? activeSession.name : 'No session loaded'}>
        <Btn variant="primary" onClick={() => onNavigate('ingest')}>＋ New session</Btn>
      </PanelHeader>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', flex: 1, overflow: 'hidden' }}>

        {/* Chat column */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid var(--border)' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {messages.length === 0 && (
              <ChatBubble role="ai" text={
                activeSession
                  ? 'Session loaded. Ask anything about the log — errors, patterns, performance issues, specific processes, and more.'
                  : 'No session loaded. Select a session from Sessions, or ingest a new log file to get started.'
              } />
            )}
            {messages.map(m => <ChatBubble key={m.id} role={m.role} text={m.text} streaming={m.streaming} />)}
            <div ref={messagesEndRef} />
          </div>

          {/* Input bar */}
          <div style={{ padding: '0.875rem 1.25rem', borderTop: '1px solid var(--border)', background: 'var(--bg-surface)', display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={activeSession ? 'Ask anything about this log…' : 'Load a session first'}
                  disabled={!activeSession || sending}
                  rows={1}
                  style={{
                    flex: 1, background: 'none', border: 'none', outline: 'none',
                    color: 'var(--text-1)', fontFamily: 'var(--font)', fontSize: 13.5,
                    lineHeight: 1.5, resize: 'none', minHeight: 22, maxHeight: 120,
                    opacity: (!activeSession || sending) ? 0.5 : 1,
                  }}
                />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', display: 'flex', gap: '1rem' }}>
                <span>
                  <kbd style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 3, padding: '0 4px', fontFamily: 'var(--mono)', fontSize: 10 }}>Enter</kbd> send &nbsp;
                  <kbd style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 3, padding: '0 4px', fontFamily: 'var(--mono)', fontSize: 10 }}>Shift+Enter</kbd> newline
                </span>
                <span style={{ marginLeft: 'auto' }}>Uses existing embeddings · no re-ingestion</span>
              </div>
            </div>
            <button
              onClick={sendMessage}
              disabled={!canSend}
              style={{
                width: 34, height: 34, background: 'var(--accent)', border: 'none', borderRadius: 7,
                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 15, flexShrink: 0,
                cursor: canSend ? 'pointer' : 'not-allowed',
                opacity: canSend ? 1 : 0.45,
              }}
            >➤</button>
          </div>
        </div>

        {/* Context sidebar */}
        <div style={{ background: 'var(--bg-surface)', overflowY: 'auto', padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <CtxCard title="⏱ Time filter">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>From</div>
                <input
                  type="datetime-local"
                  value={timeFrom}
                  onChange={e => setTimeFrom(e.target.value)}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'var(--bg-input)', border: '1px solid var(--border)',
                    borderRadius: 5, padding: '5px 7px', color: 'var(--text-1)',
                    fontFamily: 'var(--font)', fontSize: 11, outline: 'none',
                    colorScheme: 'dark',
                  }}
                />
              </div>
              <div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>To</div>
                <input
                  type="datetime-local"
                  value={timeTo}
                  onChange={e => setTimeTo(e.target.value)}
                  style={{
                    width: '100%', boxSizing: 'border-box',
                    background: 'var(--bg-input)', border: '1px solid var(--border)',
                    borderRadius: 5, padding: '5px 7px', color: 'var(--text-1)',
                    fontFamily: 'var(--font)', fontSize: 11, outline: 'none',
                    colorScheme: 'dark',
                  }}
                />
              </div>
              {(timeFrom || timeTo) && (
                <button
                  onClick={() => { setTimeFrom(''); setTimeTo('') }}
                  style={{
                    alignSelf: 'flex-end', background: 'none', border: '1px solid var(--border)',
                    borderRadius: 4, color: 'var(--text-3)', fontSize: 10, padding: '2px 8px', cursor: 'pointer',
                  }}
                >Clear filter</button>
              )}
              {!(timeFrom || timeTo) && (
                <div style={{ fontSize: 10, color: 'var(--text-3)', paddingTop: 2 }}>
                  Scope retrieval to a time window. Chunks without timestamps are always included.
                </div>
              )}
            </div>
          </CtxCard>

          <CtxCard title="⬡ Session">
            {activeSession ? (
              <>
                <CtxStat label="Files"   value={String(activeSession.file_count)} />
                <CtxStat label="Chunks"  value={activeSession.chunk_count.toLocaleString()} />
                <CtxStat label="Queries" value={String(queryCount)} />
              </>
            ) : (
              <CtxStat label="Status" value="No session loaded" />
            )}
          </CtxCard>

          <CtxCard title="◈ Retrieved chunks">
            {latestChunks.length === 0 ? (
              <div style={{ color: 'var(--text-3)', fontSize: 12, padding: '0.25rem 0' }}>Send a query to see retrieved context</div>
            ) : latestChunks.map((c, i) => (
              <div key={c.chunk_id} style={{
                paddingBottom: i < latestChunks.length - 1 ? '0.625rem' : 0,
                marginBottom:  i < latestChunks.length - 1 ? '0.625rem' : 0,
                borderBottom:  i < latestChunks.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-3)', fontFamily: 'var(--mono)' }}>line {c.line}</span>
                  <span style={{ fontSize: 10, color: 'var(--teal)', fontFamily: 'var(--mono)' }}>{(c.score * 100).toFixed(0)}%</span>
                </div>
                <div style={{ height: 3, background: 'var(--bg-hover)', borderRadius: 2, overflow: 'hidden', marginBottom: 5 }}>
                  <div style={{ height: '100%', background: 'var(--teal)', borderRadius: 2, width: `${Math.min(c.score * 100, 100)}%` }} />
                </div>
                <div style={{
                  fontSize: 10, color: 'var(--text-2)', fontFamily: 'var(--mono)',
                  whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.4,
                  maxHeight: 52, overflow: 'hidden',
                }}>
                  {c.preview}
                </div>
              </div>
            ))}
          </CtxCard>

          <CtxCard title="⬡ Token usage">
            <CtxStat label="This query"    value={lastQueryTokens > 0    ? lastQueryTokens.toLocaleString()    : '—'} accent={lastQueryTokens > 0} />
            <CtxStat label="Session total" value={sessionTotalTokens > 0 ? sessionTotalTokens.toLocaleString() : '—'} />
          </CtxCard>
        </div>
      </div>
    </>
  )
}

function ChatBubble({ role, text, streaming }: { role: 'user' | 'ai'; text: string; streaming?: boolean }) {
  const isUser = role === 'user'
  return (
    <div style={{ display: 'flex', gap: '0.75rem', maxWidth: 760, marginLeft: isUser ? 'auto' : undefined, flexDirection: isUser ? 'row-reverse' : 'row' }}>
      <div style={{
        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 700,
        background: isUser ? 'var(--accent-dim)' : 'linear-gradient(135deg, var(--teal) 0%, #0891b2 100%)',
        color: isUser ? 'var(--accent-text)' : '#fff',
      }}>
        {isUser ? 'JP' : 'AI'}
      </div>
      <div style={{
        padding: '0.75rem 1rem', borderRadius: 10, lineHeight: 1.6, fontSize: 13.5,
        background: isUser ? 'var(--accent-glow)' : 'var(--bg-panel)',
        border: `1px solid ${isUser ? 'rgba(124,58,237,0.25)' : 'var(--border)'}`,
        borderTopRightRadius: isUser ? 3 : 10,
        borderTopLeftRadius:  isUser ? 10 : 3,
        color: 'var(--text-1)', whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      }}>
        {text || (streaming ? <span style={{ color: 'var(--text-3)', fontSize: 12 }}>Thinking…</span> : null)}
      </div>
    </div>
  )
}

function CtxCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-3)' }}>
        {title}
      </div>
      <div style={{ padding: '0.625rem 0.75rem' }}>{children}</div>
    </div>
  )
}

function CtxStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', fontSize: 12 }}>
      <span style={{ color: 'var(--text-3)' }}>{label}</span>
      <span style={{ color: accent ? 'var(--teal)' : 'var(--text-1)', fontFamily: 'var(--mono)', fontSize: 11 }}>{value}</span>
    </div>
  )
}

/* ── Settings view ─────────────────────────────────────────────────────── */
const DEFAULT_PROVIDER: ProviderConfig = {
  label: '', base_url: '', api_key: '', chat_model: '',
  embedding_model: '', temperature: 0.2, max_tokens: 4096, timeout_seconds: 120,
}
const DEFAULT_INGEST: IngestConfig = { chunk_size: 50, chunk_overlap: 5 }

function SettingsView() {
  const [provider, setProvider] = useState<ProviderConfig>(DEFAULT_PROVIDER)
  const [ingest, setIngest]     = useState<IngestConfig>(DEFAULT_INGEST)
  const [showKey, setShowKey]   = useState(false)
  const [providerSaved, setProviderSaved] = useState(false)
  const [ingestSaved, setIngestSaved]     = useState(false)

  useEffect(() => {
    window.api.settings.getProvider().then(cfg => cfg && setProvider(cfg))
    window.api.settings.getIngest().then(cfg  => cfg && setIngest(cfg))
  }, [])

  const saveProvider = async () => {
    await window.api.settings.setProvider(provider)
    setProviderSaved(true)
    setTimeout(() => setProviderSaved(false), 2000)
  }

  const saveIngest = async () => {
    await window.api.settings.setIngest(ingest)
    setIngestSaved(true)
    setTimeout(() => setIngestSaved(false), 2000)
  }

  const setP = <K extends keyof ProviderConfig>(key: K, raw: string) =>
    setProvider(p => ({
      ...p,
      [key]: (key === 'temperature')
        ? (parseFloat(raw) || 0)
        : (key === 'max_tokens' || key === 'timeout_seconds')
          ? (parseInt(raw, 10) || 0)
          : raw,
    }))

  const setI = <K extends keyof IngestConfig>(key: K, raw: string) =>
    setIngest(i => ({ ...i, [key]: parseInt(raw, 10) || 0 }))

  return (
    <>
      <PanelHeader title="Settings" subtitle="LLM provider and ingestion configuration" />
      <div style={{ flex: 1, minHeight: 0, padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 640 }}>

        <SettingsCard title="LLM Provider">
          <SettingsField label="Label"            value={provider.label}           onChange={v => setP('label', v)}           placeholder="e.g. Local Ollama" />
          <SettingsField label="Base URL"         value={provider.base_url}        onChange={v => setP('base_url', v)}        placeholder="https://api.openai.com/v1" />
          <SettingsField
            label="API Key" type={showKey ? 'text' : 'password'}
            value={provider.api_key} onChange={v => setP('api_key', v)}
            placeholder="sk-…"
            suffix={
              <button onClick={() => setShowKey(s => !s)} style={{
                background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 6,
                color: 'var(--text-2)', fontSize: 11, padding: '0 10px', cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}>
                {showKey ? 'Hide' : 'Show'}
              </button>
            }
          />
          <SettingsField label="Chat Model"       value={provider.chat_model}      onChange={v => setP('chat_model', v)}      placeholder="e.g. gpt-4o" />
          <SettingsField label="Embedding Model"  value={provider.embedding_model} onChange={v => setP('embedding_model', v)} placeholder="e.g. text-embedding-3-small" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <SettingsField label="Temperature"    value={String(provider.temperature)}    onChange={v => setP('temperature', v)}    placeholder="0.2" />
            <SettingsField label="Max Tokens"     value={String(provider.max_tokens)}     onChange={v => setP('max_tokens', v)}     placeholder="4096" />
          </div>
          <SettingsField label="Timeout (seconds)" value={String(provider.timeout_seconds)} onChange={v => setP('timeout_seconds', v)} placeholder="120" />
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.75rem', paddingTop: '0.25rem' }}>
            {providerSaved && <span style={{ fontSize: 12, color: 'var(--teal)' }}>✓ Saved</span>}
            <Btn variant="primary" onClick={saveProvider}>Save provider</Btn>
          </div>
        </SettingsCard>

        <SettingsCard title="Ingestion">
          <SettingsField label="Chunk size (lines)" value={String(ingest.chunk_size)} onChange={v => setI('chunk_size', v)} placeholder="50" />
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: '-0.25rem' }}>
            Lines per chunk sent to the embedding model. Smaller = more granular retrieval, more chunks.
          </div>
          <SettingsField label="Chunk overlap (lines)" value={String(ingest.chunk_overlap)} onChange={v => setI('chunk_overlap', v)} placeholder="5" />
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: '-0.25rem' }}>
            Lines shared between adjacent chunks to preserve context at boundaries.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.75rem', paddingTop: '0.25rem' }}>
            {ingestSaved && <span style={{ fontSize: 12, color: 'var(--teal)' }}>✓ Saved</span>}
            <Btn variant="primary" onClick={saveIngest}>Save ingestion settings</Btn>
          </div>
        </SettingsCard>

      </div>
    </>
  )
}

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', flexShrink: 0 }}>
      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>
        {title}
      </div>
      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {children}
      </div>
    </div>
  )
}

function SettingsField({ label, placeholder, type = 'text', value, onChange, suffix }: {
  label: string
  placeholder?: string
  type?: string
  value: string
  onChange: (v: string) => void
  suffix?: React.ReactNode
}) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, color: 'var(--text-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
        {label}
      </label>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{
            flex: 1, background: 'var(--bg-input)', border: '1px solid var(--border)',
            borderRadius: 6, padding: '7px 10px', color: 'var(--text-1)',
            fontFamily: 'var(--font)', fontSize: 13.5, outline: 'none',
          }}
        />
        {suffix}
      </div>
    </div>
  )
}
