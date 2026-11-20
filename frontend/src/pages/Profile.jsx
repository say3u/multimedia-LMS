import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Nav from '../components/Nav.jsx'
import { api, currentUser } from '../api.js'
import { C, ui, money, timeAgo, EVENT_TEXT } from '../ui.js'

// someone's profile: follow button, their wishlist, library counts and
// recent activity -- if their privacy setting lets you see it. on your
// own profile you can change that setting.

const VISIBILITY = [
  ['public',    'Public',         'Anyone can see your wishlist, library and activity.'],
  ['followers', 'Followers only', 'Only people who follow you can see them.'],
  ['private',   'Private',        'Only you can see them.'],
]
const LIBRARY_LABEL = { backlog: 'not played yet', playing: 'playing', completed: 'finished' }

export default function Profile() {
  const { username } = useParams()
  const [data, setData]   = useState(null)
  const [error, setError] = useState('')
  const me = currentUser()
  const isMe = me?.username === username

  const load = useCallback(() => {
    setError('')
    api(`/api/users/${encodeURIComponent(username)}`).then(setData).catch((e) => setError(e.message))
  }, [username])

  useEffect(() => { load() }, [load])

  const toggleFollow = async () => {
    setError('')
    try { await api(`/api/users/${encodeURIComponent(username)}/follow`, { method: data.user.is_following ? 'DELETE' : 'POST' }); load() }
    catch (e) { setError(e.message) }
  }

  const setVisibility = async (v) => {
    setError('')
    try {
      await api('/api/me', { method: 'PATCH', body: { profile_visibility: v } })
      localStorage.setItem('user', JSON.stringify({ ...me, profile_visibility: v }))
      load()
    } catch (e) { setError(e.message) }
  }

  if (!data) {
    return <div style={ui.page}><Nav /><div style={ui.body}>{error ? <p style={ui.error}>{error}</p> : <p style={ui.muted}>Loading…</p>}</div></div>
  }
  const u = data.user

  return (
    <div style={ui.page}>
      <Nav />
      <div style={ui.body}>
        <div style={{ ...ui.row, justifyContent: 'space-between', margin: '1rem 0 1.5rem' }}>
          <div style={ui.row}>
            <div style={s.avatar}>{u.username.slice(0, 2).toUpperCase()}</div>
            <div>
              <h1 style={ui.h1}>@{u.username}</h1>
              <p style={ui.sub}>{u.followers} {u.followers === 1 ? 'follower' : 'followers'} · {u.following} following · joined {timeAgo(u.created_at)}</p>
            </div>
          </div>
          {!isMe && (
            <button style={u.is_following ? ui.ghost : ui.button} onClick={toggleFollow}>
              {u.is_following ? 'Following ✓' : 'Follow'}
            </button>
          )}
        </div>
        {error && <p style={{ ...ui.error, marginBottom: '1rem' }}>{error}</p>}

        {isMe && (
          <section style={{ ...ui.section, marginBottom: '1.25rem' }}>
            <h2 style={ui.h2}>Who can see your stuff</h2>
            <div style={ui.row}>
              {VISIBILITY.map(([v, label]) => (
                <button key={v} style={{ ...ui.pill, ...(u.profile_visibility === v ? ui.pillOn : {}) }} onClick={() => setVisibility(v)}>{label}</button>
              ))}
            </div>
            <p style={{ ...ui.muted, marginTop: '0.5rem' }}>{VISIBILITY.find(([v]) => v === u.profile_visibility)?.[2]}</p>
          </section>
        )}

        {!u.can_see ? (
          <section style={ui.section}>
            <p style={ui.muted}>
              {u.profile_visibility === 'private'
                ? `@${u.username}'s profile is private.`
                : `Follow @${u.username} to see their wishlist and activity.`}
            </p>
          </section>
        ) : (
          <div style={s.columns}>
            <section style={{ ...ui.section, flex: '1 1 380px' }}>
              <h2 style={ui.h2}>Wishlist <span style={ui.muted}>({data.wishlist.length})</span></h2>
              {data.wishlist.map((g) => (
                <Link key={g.game_id} to={`/games/${g.game_id}`} style={s.row}>
                  <span style={{ color: C.text, flex: 1 }}>{g.title}</span>
                  <span style={{ color: C.text, fontWeight: 700 }}>{money(g.best_price)}</span>
                  <span style={{ ...ui.muted, width: 120, textAlign: 'right' }}>{g.store || ''}</span>
                </Link>
              ))}
              {data.wishlist.length === 0 && <p style={ui.muted}>Nothing on their wishlist.</p>}

              <h2 style={{ ...ui.h2, marginTop: '1.25rem' }}>Library</h2>
              {Object.keys(data.library).length === 0
                ? <p style={ui.muted}>No games in their library yet.</p>
                : <p style={ui.muted}>{Object.entries(data.library).map(([k, n]) => `${n} ${LIBRARY_LABEL[k] || k}`).join(' · ')}</p>}
            </section>

            <section style={{ ...ui.section, flex: '1 1 320px' }}>
              <h2 style={ui.h2}>Recent activity</h2>
              {data.activity.map((e, i) => (
                <p key={i} style={{ ...s.activity }}>
                  <span style={{ color: C.muted }}>{EVENT_TEXT[e.event_type] || e.event_type}</span>{' '}
                  <Link to={`/games/${e.game_id}`} style={{ color: C.text, fontWeight: 600, textDecoration: 'none' }}>{e.title}</Link>
                  {e.detail && <span style={{ color: C.muted }}> ({e.detail})</span>}
                  <span style={{ ...ui.muted, fontSize: '0.75rem', display: 'block' }}>{timeAgo(e.created_at)}</span>
                </p>
              ))}
              {data.activity.length === 0 && <p style={ui.muted}>Nothing yet.</p>}
            </section>
          </div>
        )}
      </div>
    </div>
  )
}

const s = {
  avatar:   { width: 56, height: 56, borderRadius: '50%', background: C.green, color: '#080808', fontWeight: 800, fontSize: '1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  columns:  { display: 'flex', gap: '1.25rem', alignItems: 'flex-start', flexWrap: 'wrap' },
  row:      { display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0', borderTop: `1px solid ${C.border}`, textDecoration: 'none', fontSize: '0.9rem', fontVariantNumeric: 'tabular-nums' },
  activity: { margin: 0, padding: '0.5rem 0', borderTop: `1px solid ${C.border}`, fontSize: '0.9rem', lineHeight: 1.4 },
}
