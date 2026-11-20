import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Nav from '../components/Nav.jsx'
import { api } from '../api.js'
import { C, ui, timeAgo, EVENT_TEXT } from '../ui.js'

// friends feed: what the people you follow wishlisted, bought, started,
// finished or reviewed (the database fills this in with triggers).
// plus a box to find people to follow.

export default function Feed() {
  const [events, setEvents]   = useState(null)
  const [nextBefore, setNext] = useState(null)
  const [error, setError]     = useState('')

  const load = useCallback((before) => {
    api(`/api/feed${before ? `?before=${before}` : ''}`)
      .then((d) => { setEvents((old) => (before ? [...(old || []), ...d.events] : d.events)); setNext(d.next_before) })
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div style={ui.page}>
      <Nav />
      <div style={ui.body}>
        <div style={{ margin: '1rem 0 1.5rem' }}>
          <h1 style={ui.h1}>Feed</h1>
          <p style={ui.sub}>What the people you follow have been up to.</p>
        </div>

        <div style={s.columns}>
          <div style={{ flex: '1 1 480px', display: 'flex', flexDirection: 'column', gap: '0.5rem', minWidth: 0 }}>
            {error && <p style={ui.error}>{error}</p>}
            {events?.map((e) => <EventRow key={e.event_id} e={e} />)}
            {events?.length === 0 && (
              <div style={ui.section}>
                <p style={ui.muted}>Nothing here yet. Follow some people and their activity shows up here.</p>
              </div>
            )}
            {nextBefore && <button style={{ ...ui.ghost, alignSelf: 'center', marginTop: '0.5rem' }} onClick={() => load(nextBefore)}>Load more</button>}
          </div>
          <div style={{ flex: '0 1 300px', minWidth: 260 }}>
            <FindPeople onFollowChange={() => load()} />
          </div>
        </div>
      </div>
    </div>
  )
}

function EventRow({ e }) {
  return (
    <div style={s.event}>
      <div style={s.avatar}>{e.username.slice(0, 2).toUpperCase()}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, color: C.text, fontSize: '0.9rem', lineHeight: 1.4 }}>
          <Link to={`/u/${e.username}`} style={ui.link}>@{e.username}</Link>{' '}
          <span style={{ color: C.muted }}>{EVENT_TEXT[e.event_type] || e.event_type}</span>{' '}
          <Link to={`/games/${e.game_id}`} style={{ color: C.text, fontWeight: 600, textDecoration: 'none' }}>{e.title}</Link>
          {e.detail && <span style={{ color: C.muted }}> ({e.detail})</span>}
        </p>
        <span style={{ ...ui.muted, fontSize: '0.75rem' }}>{timeAgo(e.created_at)}</span>
      </div>
    </div>
  )
}

function FindPeople({ onFollowChange }) {
  const [q, setQ]         = useState('')
  const [users, setUsers] = useState([])
  const [error, setError] = useState('')

  const search = async (text) => {
    setQ(text); setError('')
    if (text.trim().length < 2) { setUsers([]); return }
    try { setUsers((await api(`/api/users?q=${encodeURIComponent(text.trim())}`)).users) }
    catch (e) { setError(e.message) }
  }

  const toggle = async (u) => {
    setError('')
    try {
      await api(`/api/users/${encodeURIComponent(u.username)}/follow`, { method: u.is_following ? 'DELETE' : 'POST' })
      setUsers(users.map((x) => (x.username === u.username ? { ...x, is_following: !x.is_following } : x)))
      onFollowChange()
    } catch (e) { setError(e.message) }
  }

  return (
    <section style={ui.section}>
      <h2 style={ui.h2}>Find people</h2>
      <input style={{ ...ui.input, width: '100%' }} placeholder="Search usernames…" value={q} onChange={(e) => search(e.target.value)} aria-label="Search usernames" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.6rem' }}>
        {users.map((u) => (
          <div key={u.username} style={{ ...ui.row, justifyContent: 'space-between' }}>
            <Link to={`/u/${u.username}`} style={ui.link}>@{u.username}</Link>
            <button style={{ ...(u.is_following ? ui.ghost : ui.button), padding: '0.3rem 0.8rem', fontSize: '0.8rem' }} onClick={() => toggle(u)}>
              {u.is_following ? 'Following' : 'Follow'}
            </button>
          </div>
        ))}
        {q.trim().length >= 2 && users.length === 0 && !error && <p style={ui.muted}>No one found.</p>}
        {error && <p style={ui.error}>{error}</p>}
      </div>
    </section>
  )
}

const s = {
  columns: { display: 'flex', gap: '1.25rem', alignItems: 'flex-start', flexWrap: 'wrap' },
  event:   { display: 'flex', gap: '0.75rem', alignItems: 'flex-start', background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '0.8rem 1rem' },
  avatar:  { width: 34, height: 34, borderRadius: '50%', background: C.green, color: '#080808', fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
}
