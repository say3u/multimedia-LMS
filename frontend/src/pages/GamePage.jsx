import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Nav from '../components/Nav.jsx'
import { api, currentUser } from '../api.js'
import { C, ui, money, timeAgo, STORE_TYPE_LABEL } from '../ui.js'

// the game page: prices on every store, price history, your watchlist
// settings (incl. "between $X and $Y" alerts), tags + mods, friends who
// want it, reviews, and -- if you added the game yourself -- edit it /
// log a price for it.

export default function GamePage() {
  const { id } = useParams()
  const [game, setGame]   = useState(null)
  const [range, setRange] = useState('1Y')
  const [error, setError] = useState('')

  const load = useCallback(() => {
    api(`/api/games/${id}?range=${range}`)
      .then(setGame)
      .catch((e) => setError(e.message))
  }, [id, range])

  useEffect(() => { load() }, [load])

  if (error) return <Shell><p style={ui.error}>{error}</p></Shell>
  if (!game) return <Shell><p style={ui.muted}>Loading…</p></Shell>

  const me = currentUser()
  const isMine = me && game.submitted_by === me.username

  return (
    <Shell>
      <div style={s.header}>
        <div>
          <h1 style={ui.h1}>{game.title}</h1>
          <p style={ui.sub}>
            {[game.developer, game.release_year].filter(Boolean).join(' · ') || 'No details yet'}
            {game.submitted_by && <> · added by <Link to={`/u/${game.submitted_by}`} style={ui.link}>@{game.submitted_by}</Link></>}
          </p>
          {game.base_game_id && (
            <p style={ui.sub}>Mod for <Link to={`/games/${game.base_game_id}`} style={ui.link}>{game.base_game_title}</Link></p>
          )}
          {game.tags?.length > 0 && (
            <div style={{ ...ui.row, gap: '0.4rem', marginTop: '0.6rem' }}>
              {game.tags.map((t) => <Link key={t} to={`/browse?tag=${encodeURIComponent(t)}`} style={ui.tag}>{t}</Link>)}
            </div>
          )}
        </div>
        {isMine && <Link to={`/games/${game.game_id}/edit`} style={{ ...ui.ghost, textDecoration: 'none' }}>Edit game</Link>}
      </div>

      <div style={s.columns}>
        <div style={s.mainCol}>
          <BestPrice game={game} />
          <Stores stores={game.stores} />
          <section style={ui.section}>
            <div style={{ ...ui.row, justifyContent: 'space-between', marginBottom: '0.75rem' }}>
              <h2 style={{ ...ui.h2, margin: 0 }}>Price history</h2>
              <div style={{ ...ui.row, gap: '0.35rem' }}>
                {['3M', '1Y', 'All'].map((r) => (
                  <button key={r} style={{ ...ui.pill, ...(range === r ? ui.pillOn : {}) }} onClick={() => setRange(r)}>{r}</button>
                ))}
              </div>
            </div>
            <PriceChart history={game.history} />
          </section>
          {game.synopsis && (
            <section style={ui.section}>
              <h2 style={ui.h2}>About</h2>
              <p style={{ ...ui.muted, lineHeight: 1.6 }}>{game.synopsis}</p>
            </section>
          )}
          <Reviews gameId={game.game_id} />
        </div>

        <div style={s.sideCol}>
          <WatchlistBox game={game} onChange={load} />
          {game.friends_want?.length > 0 && (
            <section style={ui.section}>
              <h2 style={ui.h2}>Friends who want this</h2>
              <p style={ui.muted}>
                {game.friends_want.map((u, i) => (
                  <span key={u}>{i > 0 && ', '}<Link to={`/u/${u}`} style={ui.link}>@{u}</Link></span>
                ))}
              </p>
              <p style={{ ...ui.muted, fontSize: '0.75rem', marginTop: '0.4rem' }}>Good one to buy together when it goes on sale.</p>
            </section>
          )}
          <Mods game={game} />
          {isMine && <LogPrice gameId={game.game_id} onLogged={load} />}
        </div>
      </div>
    </Shell>
  )
}

function Shell({ children }) {
  return (
    <div style={ui.page}>
      <Nav />
      <div style={ui.body}>{children}</div>
    </div>
  )
}

function BestPrice({ game }) {
  const b = game.best
  if (!b) {
    return <section style={ui.section}><p style={ui.muted}>We don't have a price for this game yet.</p></section>
  }
  const onSale = b.discount_percent > 0
  return (
    <section style={{ ...ui.section, ...ui.row, justifyContent: 'space-between' }}>
      <div>
        <div style={ui.label}>Best price now</div>
        <div style={{ ...ui.row, gap: '0.5rem', marginTop: '0.3rem' }}>
          <span style={{ ...s.bigPrice, color: onSale ? C.green : C.text }}>{money(b.price, b.currency)}</span>
          {onSale && <span style={s.was}>{money(b.regular_price, b.currency)}</span>}
          {onSale && <span style={s.badge}>−{b.discount_percent}%</span>}
        </div>
        <p style={{ ...ui.muted, marginTop: '0.3rem' }}>
          on {b.store}{b.store_type && b.store_type !== 'pc' ? ` (${STORE_TYPE_LABEL[b.store_type]})` : ''}
          {game.lowest_ever != null && ` · lowest ever ${money(game.lowest_ever, b.currency)}`}
        </p>
      </div>
      {b.url && <a href={b.url} target="_blank" rel="noreferrer" style={{ ...ui.button, textDecoration: 'none' }}>Open store ↗</a>}
    </section>
  )
}

function Stores({ stores }) {
  if (!stores?.length) return null
  // group by store type so a mobile price isn't mixed in with pc ones
  const groups = {}
  stores.forEach((st) => { (groups[st.store_type || 'pc'] ||= []).push(st) })
  return (
    <section style={ui.section}>
      <h2 style={ui.h2}>Every store</h2>
      {Object.entries(groups).map(([type, list]) => (
        <div key={type} style={{ marginBottom: '0.75rem' }}>
          {Object.keys(groups).length > 1 && <div style={{ ...ui.label, marginBottom: '0.35rem' }}>{STORE_TYPE_LABEL[type] || type}</div>}
          {list.map((st) => (
            <div key={st.store} style={s.storeRow}>
              <span style={{ color: C.text, flex: 1 }}>
                {st.url ? <a href={st.url} target="_blank" rel="noreferrer" style={{ color: C.text }}>{st.store}</a> : st.store}
              </span>
              <span style={{ color: st.discount_percent > 0 ? C.green : C.text, fontWeight: 700, width: 80, textAlign: 'right' }}>{money(st.price, st.currency)}</span>
              <span style={{ ...ui.muted, width: 60, textAlign: 'right' }}>{st.discount_percent > 0 ? `−${st.discount_percent}%` : ''}</span>
              <span style={{ ...ui.muted, width: 130, textAlign: 'right' }}>low {money(st.lowest_ever, st.currency)}</span>
            </div>
          ))}
        </div>
      ))}
    </section>
  )
}

// tiny svg line chart, one line per store. no chart library needed
const LINE_COLORS = ['#2fd06a', '#60a5fa', '#f59e0b', '#e879f9', '#f87171']
function PriceChart({ history }) {
  if (!history?.length) return <p style={ui.muted}>No price checks in this range yet.</p>
  const W = 640, H = 180, pad = 32, left = 60  // left = room for the price labels
  const times  = history.map((h) => new Date(h.date).getTime())
  const prices = history.map((h) => h.price)
  const t0 = Math.min(...times), t1 = Math.max(...times)
  const lo = Math.min(...prices), hi = Math.max(...prices)
  const x = (t) => left + (t1 === t0 ? (W - left - pad) / 2 : ((t - t0) / (t1 - t0)) * (W - left - pad))
  const y = (p) => H - pad - (hi === lo ? (H - 2 * pad) / 2 : ((p - lo) / (hi - lo)) * (H - 2 * pad))
  const stores = [...new Set(history.map((h) => h.store))]

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label="Price history chart">
        <text x={4} y={y(hi) + 4} fill={C.muted} fontSize="11">{money(hi)}</text>
        <text x={4} y={y(lo) + 4} fill={C.muted} fontSize="11">{money(lo)}</text>
        <line x1={left} x2={W - pad} y1={H - pad} y2={H - pad} stroke={C.border} />
        {stores.map((store, i) => {
          const pts = history.filter((h) => h.store === store)
          const color = LINE_COLORS[i % LINE_COLORS.length]
          return (
            <g key={store}>
              <polyline fill="none" stroke={color} strokeWidth="2"
                points={pts.map((h) => `${x(new Date(h.date).getTime())},${y(h.price)}`).join(' ')} />
              {pts.map((h, j) => <circle key={j} cx={x(new Date(h.date).getTime())} cy={y(h.price)} r="3" fill={color} />)}
            </g>
          )
        })}
      </svg>
      <div style={{ ...ui.row, gap: '1rem', marginTop: '0.4rem' }}>
        {stores.map((store, i) => (
          <span key={store} style={{ ...ui.muted, fontSize: '0.75rem' }}>
            <span style={{ color: LINE_COLORS[i % LINE_COLORS.length] }}>●</span> {store}
          </span>
        ))}
      </div>
    </div>
  )
}

const OWNED_LABEL = { backlog: 'Own it, not played yet', playing: 'Playing', completed: 'Completed' }

function WatchlistBox({ game, onChange }) {
  const [target, setTarget] = useState(game.target_price ?? '')
  const [min, setMin]       = useState(game.min_price ?? '')
  const [msg, setMsg]       = useState('')
  const [error, setError]   = useState('')
  const status = game.my_status

  useEffect(() => { setTarget(game.target_price ?? ''); setMin(game.min_price ?? '') }, [game.target_price, game.min_price])

  const run = async (fn, done) => {
    setError(''); setMsg('')
    try { await fn(); if (done) setMsg(done); onChange() } catch (e) { setError(e.message) }
  }
  const num = (v) => (v === '' ? null : Number(v))

  if (status && status !== 'want_to_play') {
    return (
      <section style={ui.section}>
        <h2 style={ui.h2}>In your library</h2>
        <p style={ui.muted}>{OWNED_LABEL[status]}. Games you own aren't price tracked.</p>
      </section>
    )
  }

  if (!game.on_watchlist) {
    return (
      <section style={ui.section}>
        <h2 style={ui.h2}>Track this game</h2>
        <div style={{ ...ui.row, flexDirection: 'column', alignItems: 'stretch' }}>
          <button style={ui.button} onClick={() => run(() => api('/api/watchlist', { method: 'POST', body: { game_id: game.game_id } }))}>Add to watchlist</button>
          <button style={ui.ghost} onClick={() => run(() => api('/api/library', { method: 'POST', body: { game_id: game.game_id } }))}>I already own it</button>
        </div>
        {error && <p style={{ ...ui.error, marginTop: '0.5rem' }}>{error}</p>}
      </section>
    )
  }

  return (
    <section style={ui.section}>
      <h2 style={ui.h2}>On your watchlist</h2>
      <label style={s.check}>
        <input type="checkbox" checked={game.notify}
          onChange={(e) => run(() => api(`/api/watchlist/${game.game_id}`, { method: 'PATCH', body: { notify_enabled: e.target.checked } }))} />
        Alert me about price drops
      </label>

      <div style={{ ...ui.label, margin: '0.9rem 0 0.35rem' }}>Alert when the price is</div>
      <div style={{ ...ui.row, gap: '0.35rem', flexWrap: 'nowrap' }}>
        <span style={ui.muted}>between $</span>
        <input style={{ ...ui.input, width: 62, padding: '0.45rem 0.5rem' }} type="number" min="0" step="0.01" placeholder="any" value={min} onChange={(e) => setMin(e.target.value)} aria-label="Minimum price" />
        <span style={ui.muted}>and $</span>
        <input style={{ ...ui.input, width: 62, padding: '0.45rem 0.5rem' }} type="number" min="0" step="0.01" placeholder="any" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Target price" />
      </div>
      <button style={{ ...ui.button, marginTop: '0.6rem' }}
        onClick={() => run(() => api(`/api/watchlist/${game.game_id}`, { method: 'PATCH', body: { target_price: num(target), min_price: num(min) } }), 'Saved')}>
        Save
      </button>
      <p style={{ ...ui.muted, fontSize: '0.75rem', marginTop: '0.4rem' }}>Leave the first box empty for "anything under".</p>

      <hr style={s.hr} />
      <div style={{ ...ui.row }}>
        <button style={ui.ghost} onClick={() => run(() => api('/api/library', { method: 'POST', body: { game_id: game.game_id, paid_price: game.best?.price ?? null, store: game.best?.store ?? null } }))}>I bought it</button>
        <button style={{ ...ui.ghost, color: C.red }} onClick={() => run(() => api(`/api/watchlist/${game.game_id}`, { method: 'DELETE' }))}>Remove</button>
      </div>
      {msg && <p style={{ color: C.green, fontSize: '0.85rem', marginTop: '0.5rem' }}>{msg}</p>}
      {error && <p style={{ ...ui.error, marginTop: '0.5rem' }}>{error}</p>}
    </section>
  )
}

function Mods({ game }) {
  const [mods, setMods] = useState([])
  useEffect(() => {
    if (!game.mod_count) { setMods([]); return }
    api(`/api/games/${game.game_id}/mods`).then((d) => setMods(d.mods)).catch(() => {})
  }, [game.game_id, game.mod_count])
  if (game.base_game_id) return null // mods of mods, not a thing
  return (
    <section style={ui.section}>
      <h2 style={ui.h2}>Mods {mods.length > 0 && <span style={ui.muted}>({mods.length})</span>}</h2>
      {mods.map((m) => (
        <p key={m.game_id} style={{ ...ui.muted, marginBottom: '0.35rem' }}>
          <Link to={`/games/${m.game_id}`} style={ui.link}>{m.title}</Link>
          {m.submitted_by && <> by @{m.submitted_by}</>}
        </p>
      ))}
      <Link to={`/games/new?mod=${game.game_id}`} style={{ ...ui.link, fontSize: '0.85rem' }}>+ Add a mod</Link>
    </section>
  )
}

function LogPrice({ gameId, onLogged }) {
  const [form, setForm] = useState({ store: '', price: '', regular_price: '', store_type: 'pc', url: '' })
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const submit = async (e) => {
    e.preventDefault(); setError(''); setMsg('')
    try {
      await api(`/api/games/${gameId}/prices`, {
        method: 'POST',
        body: {
          store: form.store, price: Number(form.price),
          regular_price: form.regular_price === '' ? Number(form.price) : Number(form.regular_price),
          store_type: form.store_type, url: form.url || null,
        },
      })
      setMsg('Price logged'); setForm({ ...form, price: '', regular_price: '' }); onLogged()
    } catch (err) { setError(err.message) }
  }

  return (
    <section style={ui.section}>
      <h2 style={ui.h2}>Log a price</h2>
      <p style={{ ...ui.muted, fontSize: '0.75rem', marginBottom: '0.6rem' }}>You added this game, so you can log prices you find for it. Anyone watching it gets alerted.</p>
      <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <input style={ui.input} placeholder="Store (e.g. itch.io)" value={form.store} onChange={set('store')} required />
        <div style={{ ...ui.row, gap: '0.4rem', flexWrap: 'nowrap' }}>
          <input style={{ ...ui.input, width: '50%' }} type="number" min="0" step="0.01" placeholder="Price" value={form.price} onChange={set('price')} required />
          <input style={{ ...ui.input, width: '50%' }} type="number" min="0" step="0.01" placeholder="Normal price" value={form.regular_price} onChange={set('regular_price')} />
        </div>
        <select style={ui.input} value={form.store_type} onChange={set('store_type')} aria-label="Store type">
          {Object.entries(STORE_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input style={ui.input} placeholder="Link (optional)" value={form.url} onChange={set('url')} />
        <button style={ui.button} type="submit">Log price</button>
      </form>
      {msg && <p style={{ color: C.green, fontSize: '0.85rem', marginTop: '0.5rem' }}>{msg}</p>}
      {error && <p style={{ ...ui.error, marginTop: '0.5rem' }}>{error}</p>}
    </section>
  )
}

function Reviews({ gameId }) {
  const me = currentUser()
  const [data, setData]     = useState(null)
  const [rating, setRating] = useState(8)
  const [text, setText]     = useState('')
  const [error, setError]   = useState('')

  const load = useCallback(() => {
    api(`/api/games/${gameId}/reviews`).then((d) => {
      setData(d)
      const mine = d.reviews.find((r) => r.username === me?.username)
      if (mine) { setRating(mine.rating); setText(mine.review_text || '') }
    }).catch((e) => setError(e.message))
  }, [gameId, me?.username])

  useEffect(() => { load() }, [load])

  const save = async (e) => {
    e.preventDefault(); setError('')
    try { await api(`/api/games/${gameId}/reviews`, { method: 'POST', body: { rating: Number(rating), review_text: text || null } }); load() }
    catch (err) { setError(err.message) }
  }
  const remove = async () => {
    setError('')
    try { await api(`/api/games/${gameId}/reviews`, { method: 'DELETE' }); setText(''); setRating(8); load() }
    catch (err) { setError(err.message) }
  }

  if (!data) return null
  const mine = data.reviews.find((r) => r.username === me?.username)

  return (
    <section style={ui.section}>
      <h2 style={ui.h2}>
        Reviews {data.review_count > 0 && <span style={ui.muted}>· {data.average_rating}/10 average from {data.review_count}</span>}
      </h2>

      <form onSubmit={save} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
        <div style={ui.row}>
          <span style={ui.label}>{mine ? 'Your review' : 'Write a review'}</span>
          <select style={{ ...ui.input, padding: '0.35rem 0.6rem' }} value={rating} onChange={(e) => setRating(e.target.value)} aria-label="Rating">
            {[10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n}/10</option>)}
          </select>
        </div>
        <textarea style={{ ...ui.input, minHeight: 70, resize: 'vertical' }} placeholder="What did you think? (optional)" value={text} onChange={(e) => setText(e.target.value)} maxLength={5000} />
        <div style={ui.row}>
          <button style={ui.button} type="submit">{mine ? 'Update review' : 'Post review'}</button>
          {mine && <button type="button" style={ui.ghost} onClick={remove}>Delete</button>}
        </div>
        {error && <p style={ui.error}>{error}</p>}
      </form>

      {data.reviews.filter((r) => r.username !== me?.username).map((r) => (
        <div key={r.username} style={s.review}>
          <div style={ui.row}>
            <Link to={`/u/${r.username}`} style={ui.link}>@{r.username}</Link>
            {r.is_friend && <span style={ui.tag}>following</span>}
            <span style={{ color: C.text, fontWeight: 700 }}>{r.rating}/10</span>
            <span style={{ ...ui.muted, fontSize: '0.75rem' }}>{timeAgo(r.created_at)}</span>
          </div>
          {r.review_text && <p style={{ ...ui.muted, marginTop: '0.35rem', lineHeight: 1.5 }}>{r.review_text}</p>}
        </div>
      ))}
      {data.reviews.length === 0 && <p style={ui.muted}>No reviews yet. Be the first.</p>}
    </section>
  )
}

const s = {
  header:   { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', margin: '1rem 0 1.75rem' },
  columns:  { display: 'flex', gap: '1.25rem', alignItems: 'flex-start', flexWrap: 'wrap' },
  mainCol:  { flex: '1 1 520px', display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 0 },
  sideCol:  { flex: '0 1 300px', display: 'flex', flexDirection: 'column', gap: '1.25rem', minWidth: 260 },
  bigPrice: { fontSize: '2rem', fontWeight: 800, fontVariantNumeric: 'tabular-nums', lineHeight: 1 },
  was:      { fontSize: '0.9rem', color: 'rgba(255,255,255,0.3)', textDecoration: 'line-through' },
  badge:    { fontSize: '0.75rem', fontWeight: 800, color: '#052e16', background: C.green, borderRadius: 5, padding: '2px 6px' },
  storeRow: { display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem 0', borderTop: `1px solid ${C.border}`, fontSize: '0.9rem', fontVariantNumeric: 'tabular-nums' },
  check:    { display: 'flex', alignItems: 'center', gap: '0.5rem', color: C.text, fontSize: '0.9rem', cursor: 'pointer' },
  hr:       { border: 'none', borderTop: `1px solid ${C.border}`, margin: '1rem 0' },
  review:   { borderTop: `1px solid ${C.border}`, padding: '0.75rem 0' },
}
