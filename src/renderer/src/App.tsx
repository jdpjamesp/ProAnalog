import React, { useState } from 'react'

type View = 'sessions' | 'ingest' | 'query' | 'settings'

export default function App(): React.JSX.Element {
  const [view, setView] = useState<View>('sessions')

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
      <nav style={{ width: 180, background: '#1e1e2e', color: '#cdd6f4', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <h2 style={{ margin: '0 0 1rem', fontSize: '1.1rem' }}>ProAnalog</h2>
        {(['sessions', 'ingest', 'query', 'settings'] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              background: view === v ? '#313244' : 'transparent',
              color: '#cdd6f4',
              border: 'none',
              padding: '0.5rem 0.75rem',
              borderRadius: 4,
              cursor: 'pointer',
              textAlign: 'left',
              textTransform: 'capitalize'
            }}
          >
            {v}
          </button>
        ))}
      </nav>
      <main style={{ flex: 1, padding: '1.5rem', background: '#181825', color: '#cdd6f4' }}>
        <h1 style={{ marginTop: 0, textTransform: 'capitalize' }}>{view}</h1>
        <p style={{ color: '#6c7086' }}>— placeholder —</p>
      </main>
    </div>
  )
}
