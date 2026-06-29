import React, { useState, useRef, useEffect } from 'react'
import './styles.css'

type View = 'sessions' | 'ingest' | 'query' | 'settings'

export default function App(): React.JSX.Element {
  const [view, setView] = useState<View>('query')

  return (
    <div style={shell}>
      <Titlebar />
      <Sidebar view={view} onNavigate={setView} />
      <main style={mainStyle}>
        {view === 'sessions'  && <SessionsView />}
        {view === 'ingest'    && <IngestView />}
        {view === 'query'     && <QueryView />}
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
function Titlebar() {
  return (
    <header style={{
      gridColumn: '1 / -1',
      background: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border)',
      display: 'flex',
      alignItems: 'center',
      padding: '0 1rem',
      gap: '0.75rem',
      WebkitAppRegion: 'drag' as never,
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
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--teal)', display: 'inline-block' }} />
        No session loaded
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
function Sidebar({ view, onNavigate }: { view: View; onNavigate: (v: View) => void }) {
  return (
    <aside style={{
      background: 'var(--bg-surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      padding: '0.75rem 0',
      overflowY: 'auto',
    }}>
      <NavSection label="Analysis">
        <NavItem icon="⊞" label="Sessions"  active={view === 'sessions'}  onClick={() => onNavigate('sessions')} badge="0" />
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
        <span style={{ display: 'block', marginTop: 2 }}>No provider configured</span>
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

function Btn({ variant = 'ghost', children, onClick }: { variant?: 'primary' | 'ghost'; children: React.ReactNode; onClick?: () => void }) {
  const [hovered, setHovered] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '5px 12px', borderRadius: 5, fontSize: 12, fontWeight: 500,
        border: '1px solid transparent', transition: 'all 0.12s',
        background: variant === 'primary'
          ? (hovered ? '#6d28d9' : 'var(--accent)')
          : (hovered ? 'var(--bg-hover)' : 'transparent'),
        color: variant === 'primary' ? '#fff' : hovered ? 'var(--text-1)' : 'var(--text-2)',
        borderColor: variant === 'primary' ? 'var(--accent)' : 'var(--border)',
      }}
    >{children}</button>
  )
}

/* ── Sessions view ─────────────────────────────────────────────────────── */
function SessionsView() {
  return (
    <>
      <PanelHeader title="Sessions" subtitle="Past log analysis sessions">
        <Btn variant="primary">＋ New session</Btn>
      </PanelHeader>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', flexDirection: 'column', gap: '0.5rem' }}>
        <div style={{ fontSize: 32, opacity: 0.3 }}>⊞</div>
        <div>No sessions yet — ingest a log file to get started</div>
      </div>
    </>
  )
}

/* ── Ingest view ───────────────────────────────────────────────────────── */
function IngestView() {
  const [dragging, setDragging] = useState(false)
  return (
    <>
      <PanelHeader title="Ingest" subtitle="Load a log file to create a new analysis session" />
      <div style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false) }}
          style={{
            border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border-light)'}`,
            borderRadius: 12,
            background: dragging ? 'var(--accent-glow)' : 'var(--bg-panel)',
            padding: '3rem',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem',
            transition: 'all 0.15s', cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 40, opacity: dragging ? 1 : 0.4 }}>↑</div>
          <div style={{ fontSize: 15, color: 'var(--text-1)' }}>Drop a <code style={{ fontFamily: 'var(--mono)', background: 'var(--bg-hover)', padding: '1px 5px', borderRadius: 3, color: 'var(--teal)' }}>.log</code> file here</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)' }}>or</div>
          <Btn variant="primary">Browse files…</Btn>
        </div>

        <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 8, padding: '1rem 1.25rem' }}>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Session name</div>
          <input
            placeholder="e.g. prod-app-server-2026-06-28"
            style={{
              width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)',
              borderRadius: 6, padding: '7px 10px', color: 'var(--text-1)',
              fontFamily: 'var(--font)', fontSize: 13.5, outline: 'none',
            }}
          />
        </div>
      </div>
    </>
  )
}

/* ── Query view ────────────────────────────────────────────────────────── */
function QueryView() {
  const [input, setInput] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [input])

  return (
    <>
      <PanelHeader title="Query" subtitle="No session loaded">
        <Btn variant="ghost">Export</Btn>
        <Btn variant="primary">＋ New session</Btn>
      </PanelHeader>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', flex: 1, overflow: 'hidden' }}>

        {/* Chat */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', borderRight: '1px solid var(--border)' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <ChatMessage role="ai" text="Load a log file to begin. Once ingested, you can ask anything about the log — errors, patterns, performance issues, specific processes, and more." />
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '0.875rem 1.25rem', borderTop: '1px solid var(--border)', background: 'var(--bg-surface)', display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{
                background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8,
                padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask anything about this log…"
                  rows={1}
                  style={{
                    flex: 1, background: 'none', border: 'none', outline: 'none',
                    color: 'var(--text-1)', fontFamily: 'var(--font)', fontSize: 13.5,
                    lineHeight: 1.5, resize: 'none', minHeight: 22, maxHeight: 120,
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
            <button style={{
              width: 34, height: 34, background: 'var(--accent)', border: 'none', borderRadius: 7,
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 15, flexShrink: 0, cursor: 'pointer',
            }}>➤</button>
          </div>
        </div>

        {/* Context sidebar */}
        <div style={{ background: 'var(--bg-surface)', overflowY: 'auto', padding: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
          <CtxCard title="⬡ Session">
            <CtxStat label="Status" value="No session loaded" />
          </CtxCard>
          <CtxCard title="◈ Retrieved chunks">
            <div style={{ color: 'var(--text-3)', fontSize: 12, padding: '0.25rem 0' }}>Send a query to see retrieved context</div>
          </CtxCard>
          <CtxCard title="⬡ Token usage">
            <CtxStat label="This query" value="—" />
            <CtxStat label="Session total" value="—" />
          </CtxCard>
        </div>
      </div>
    </>
  )
}

function ChatMessage({ role, text }: { role: 'user' | 'ai'; text: string }) {
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
        borderTopLeftRadius: isUser ? 10 : 3,
        color: 'var(--text-1)',
      }}>
        {text}
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
function SettingsView() {
  return (
    <>
      <PanelHeader title="Settings" subtitle="LLM provider and ingestion configuration" />
      <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', maxWidth: 640 }}>

        {/* Provider */}
        <SettingsCard title="LLM Provider">
          <SettingsField label="Label" placeholder="e.g. Gemini via OpenAI compat" />
          <SettingsField label="Base URL" placeholder="https://api.openai.com/v1" />
          <SettingsField label="API Key" type="password" />
          <SettingsField label="Chat Model" placeholder="e.g. gemini-2.5-flash" />
          <SettingsField label="Embedding Model" placeholder="e.g. text-embedding-3-small" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <SettingsField label="Temperature" placeholder="0.2" />
            <SettingsField label="Max Tokens" placeholder="4096" />
          </div>
          <SettingsField label="Timeout (seconds)" placeholder="120" />
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.25rem' }}>
            <Btn variant="primary">Save provider</Btn>
          </div>
        </SettingsCard>

        {/* Ingestion */}
        <SettingsCard title="Ingestion">
          <SettingsField label="Chunk size (chars)" placeholder="800000" />
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: '-0.25rem' }}>
            Maximum characters per chunk sent to the embedding model. Larger values mean fewer chunks but higher token cost per query.
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.25rem' }}>
            <Btn variant="primary">Save ingestion settings</Btn>
          </div>
        </SettingsCard>

      </div>
    </>
  )
}

function SettingsCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>
        {title}
      </div>
      <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {children}
      </div>
    </div>
  )
}

function SettingsField({ label, placeholder, type = 'text' }: { label: string; placeholder?: string; type?: string }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 11, color: 'var(--text-3)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        style={{
          width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)',
          borderRadius: 6, padding: '7px 10px', color: 'var(--text-1)',
          fontFamily: 'var(--font)', fontSize: 13.5, outline: 'none',
        }}
      />
    </div>
  )
}
