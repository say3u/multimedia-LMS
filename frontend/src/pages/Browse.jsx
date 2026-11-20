import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Nav from '../components/Nav.jsx'
import { api } from '../api.js'
import { C, ui, money, STORE_TYPE_LABEL } from '../ui.js'

// browse / search every game we have, filtered by tag (mod, vr,
// obscure...) and store type (pc, mobile...). filters live in the url
// like on the dashboard, so links like /browse?tag=mod work.

const QUICK_TAGS = ['mod', 'vr', 'co-op', 'obscure']

export default function Browse() {
  const [params, setParams] = useSearchParams()
  const q         = params.get('q') || ''
  const tag       = params.get('tag') || ''
  const storeType = params.get('store_type') || ''
  const [text, setText]       = useState(q)
  const [results, setResults] = useState(null)
  const [error, setError]     = useState('')

  const update = (changes) => {
    const next = new URLSearchParams(params)
    Object.entries(changes).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)))
    setParams(next, { replace: true })
  }

  useEffect(() => { setText(q) }, [q])

  useEffect(() => {
    setError('')
    if (q.trim().length < 2 && !tag && !storeType) { setResults(null); return }
    const qs = new URLSearchParams()
    if (q.trim()) qs.set('q', q.trim())
    if (tag) qs.set('tag', tag)
    if (storeType) qs.set('store_type', storeType)
    api(`/api/search?${qs}`).then((d) => setResults(d.results)).catch((e) => setError(e.message))
  }, [q, tag, storeType])

  return (
    <div style={ui.page}>
      <Nav />
      <div style={ui.body}>
        <div style={{ margin: '1rem 0 1.5rem' }}>
          <h1 style={ui.h1}>Browse games</h1>
          <p style={ui.sub}>Search everything we track, including mods and games people added themselves.</p>
        </div>

        <form style={{ ...ui.row, marginBottom: '1rem' }} onSubmit={(e) => { e.preventDefault(); update({ q: text }) }}>
          <input style={{ ...ui.input, flex: '1 1 300px' }} placeholder="Search by title…" value={text} onChange={(e) => setText(e.target.value)} aria-label="Search games" />
          <button style={ui.button} type="submit">Search</button>
        </form>

        <div style={{ ...ui.row, marginBottom: '0.6rem' }}>
          <span style={ui.label}>Store</span>
          {[['', 'Any'], ...Object.entries(STORE_TYPE_LABEL)].map(([v, l]) => (
            <button key={v || 'any'} style={{ ...ui.pill, ...(storeType === v ? ui.pillOn : {}) }} onClick={() => update({ store_type: v })}>{l}</button>
          ))}
        </div>
        <div style={{ ...ui.row, marginBottom: '1.5rem' }}>
          <span style={ui.label}>Tag</span>
          {['', ...new Set([...QUICK_TAGS, ...(tag ? [tag] : [])])].map((t) => (
            <button key={t || 'any'} style={{ ...ui.pill, ...(tag === t ? ui.pillOn : {}) }} onClick={() => update({ tag: t })}>{t || 'Any'}</button>
          ))}
        </div>

        {error && <p style={ui.error}>{error}</p>}
        {results === null && !error && <p style={ui.muted}>Type at least 2 letters, or pick a store type or tag.</p>}

        {results && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {results.map((g) => (
              <Link key={g.game_id} to={`/games/${g.game_id}`} style={s.result}>
                <span style={{ color: C.text, fontWeight: 600, flex: 1 }}>{g.title}</span>
                {g.on_watchlist && <span style={ui.tag}>watching</span>}
                <span style={{ ...ui.muted, width: 110, textAlign: 'right' }}>{g.stores_found} {g.stores_found === 1 ? 'store' : 'stores'}</span>
                <span style={{ color: C.text, fontWeight: 700, width: 170, textAlign: 'right' }}>
                  {g.best_price != null ? <>{money(g.best_price)} <span style={ui.muted}>on {g.best_store}</span></> : <span style={ui.muted}>no price yet</span>}
                </span>
              </Link>
            ))}
            {results.length === 0 && <p style={ui.muted}>Nothing found.</p>}
          </div>
        )}

        <p style={{ ...ui.muted, marginTop: '2rem' }}>
          Can't find it? <Link to="/games/new" style={ui.link}>Add it yourself</Link>. Mods, obscure or delisted games are all welcome.
        </p>
      </div>
    </div>
  )
}

const s = {
  result: { display: 'flex', alignItems: 'center', gap: '0.75rem', background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '0.8rem 1.1rem', textDecoration: 'none', fontSize: '0.9rem', fontVariantNumeric: 'tabular-nums' },
}
