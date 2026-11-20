import { useState, useEffect, useRef } from 'react'

const STATUSES = [
  { value: 'want_to_play', label: 'Want to Play' },
  { value: 'playing',      label: 'Playing'      },
  { value: 'completed',    label: 'Completed'     },
]

export default function AddGameModal({ onClose }) {
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState([])
  const [selected, setSelected] = useState(null)
  const [status,   setStatus]   = useState('want_to_play')
  const [error,    setError]    = useState('')
  const [saving,   setSaving]   = useState(false)
  const inputRef = useRef(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const search = async (q) => {
    setQuery(q)
    setSelected(null)
    if (q.trim().length < 2) { setResults([]); return }
    try {
      const res  = await fetch(`/api/games?q=${encodeURIComponent(q)}&limit=10`)
      const data = await res.json()
      setResults(data.games || [])
    } catch {
      setResults([])
    }
  }

  const handleAdd = async () => {
    if (!selected || saving) return
    setSaving(true)
    setError('')
    try {
      const token = localStorage.getItem('token')
      const res   = await fetch('/api/games/user-games', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({ game_id: selected.game_id, status }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Something went wrong.'); setSaving(false); return }
      onClose()
    } catch {
      setError('Network error. Please try again.')
      setSaving(false)
    }
  }

  return (
    <div style={s.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>

        <div style={s.header}>
          <span style={s.title}>Add Game</span>
          <button style={s.close} onClick={onClose}>✕</button>
        </div>

        <div style={s.body}>
          <label style={s.label}>Search for a game</label>
          <input
            ref={inputRef}
            style={s.input}
            placeholder="e.g. Elden Ring"
            value={query}
            onChange={(e) => search(e.target.value)}
          />

          {results.length > 0 && !selected && (
            <ul style={s.results}>
              {results.map((g) => (
                <li
                  key={g.game_id}
                  style={s.resultItem}
                  onClick={() => { setSelected(g); setResults([]) }}
                >
                  {g.icon_url && <img src={g.icon_url} alt="" style={s.thumb} />}
                  <div>
                    <div style={s.gameTitle}>{g.title}</div>
                    {g.release_year && <div style={s.gameMeta}>{g.release_year}</div>}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {selected && (
            <div style={s.selectedGame}>
              {selected.icon_url && <img src={selected.icon_url} alt="" style={s.thumb} />}
              <div>
                <div style={s.gameTitle}>{selected.title}</div>
                {selected.release_year && <div style={s.gameMeta}>{selected.release_year}</div>}
              </div>
              <button style={s.clearBtn} onClick={() => { setSelected(null); setQuery('') }}>✕</button>
            </div>
          )}

          <label style={s.label}>Status</label>
          <div style={s.pills}>
            {STATUSES.map(({ value, label }) => (
              <button
                key={value}
                style={{ ...s.pill, ...(status === value ? s.pillActive : {}) }}
                onClick={() => setStatus(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && <p style={s.error}>{error}</p>}

        <div style={s.footer}>
          <button style={s.cancelBtn} onClick={onClose}>Cancel</button>
          <button
            style={{ ...s.addBtn, opacity: selected && !saving ? 1 : 0.4 }}
            onClick={handleAdd}
            disabled={!selected || saving}
          >
            {saving ? 'Adding…' : 'Add Game'}
          </button>
        </div>

      </div>
    </div>
  )
}

const s = {
  overlay:      { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal:        { background: '#141414', border: '1px solid #2a2a2a', borderRadius: 12, width: '100%', maxWidth: 460, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header:       { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid #2a2a2a' },
  title:        { color: '#e2e8f0', fontWeight: 700, fontSize: '1rem', fontFamily: 'system-ui, sans-serif' },
  close:        { background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 },
  body:         { padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' },
  label:        { color: '#94a3b8', fontSize: '0.8rem', fontFamily: 'system-ui, sans-serif', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' },
  input:        { background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 8, padding: '0.6rem 0.85rem', color: '#e2e8f0', fontSize: '0.9rem', fontFamily: 'system-ui, sans-serif', outline: 'none' },
  results:      { listStyle: 'none', margin: 0, padding: 0, background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 8, overflow: 'hidden', maxHeight: 220, overflowY: 'auto' },
  resultItem:   { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.85rem', cursor: 'pointer', borderBottom: '1px solid #2a2a2a' },
  selectedGame: { display: 'flex', alignItems: 'center', gap: '0.75rem', background: '#1e1e1e', border: '1px solid #2fd06a33', borderRadius: 8, padding: '0.6rem 0.85rem' },
  thumb:        { width: 36, height: 48, objectFit: 'cover', borderRadius: 4, flexShrink: 0 },
  gameTitle:    { color: '#e2e8f0', fontSize: '0.875rem', fontFamily: 'system-ui, sans-serif', fontWeight: 600 },
  gameMeta:     { color: '#94a3b8', fontSize: '0.75rem', fontFamily: 'system-ui, sans-serif' },
  clearBtn:     { marginLeft: 'auto', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem' },
  pills:        { display: 'flex', gap: '0.5rem', flexWrap: 'wrap' },
  pill:         { background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 20, padding: '0.35rem 0.9rem', color: '#94a3b8', fontSize: '0.8rem', fontFamily: 'system-ui, sans-serif', cursor: 'pointer' },
  pillActive:   { background: '#2fd06a18', border: '1px solid #2fd06a', color: '#2fd06a' },
  error:        { color: '#f87171', fontSize: '0.8rem', fontFamily: 'system-ui, sans-serif', margin: '0 1.5rem' },
  footer:       { display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', padding: '1rem 1.5rem', borderTop: '1px solid #2a2a2a' },
  cancelBtn:    { background: 'none', border: '1px solid #2a2a2a', borderRadius: 8, padding: '0.5rem 1rem', color: '#94a3b8', fontSize: '0.875rem', fontFamily: 'system-ui, sans-serif', cursor: 'pointer' },
  addBtn:       { background: '#2fd06a', border: 'none', borderRadius: 8, padding: '0.5rem 1.25rem', color: '#080808', fontSize: '0.875rem', fontFamily: 'system-ui, sans-serif', fontWeight: 700, cursor: 'pointer' },
}
