import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Nav from '../components/Nav.jsx'
import AddGameModal from '../components/AddGameModal.jsx'

const TAB_STATUSES = {
  Watchlist:   ['want_to_play'],
  'My Library': ['playing', 'completed'],
}

const STATUS_LABEL = {
  want_to_play: 'Want to Play',
  playing:      'Playing',
  completed:    'Completed',
}

export default function Dashboard() {
  const navigate             = useNavigate()
  const [user, setUser]      = useState(JSON.parse(localStorage.getItem('user') || 'null'))
  const [searchParams]       = useSearchParams()
  const tab                  = searchParams.get('tab') || 'Watchlist'
  const [showAddGame, setShowAddGame] = useState(false)
  const [games, setGames]    = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { navigate('/login'); return }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => {
        if (res.status === 401 || res.status === 422) {
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          navigate('/login')
          return null
        }
        return res.json()
      })
      .then((data) => { if (data?.user) setUser(data.user) })
      .catch(() => {})
  }, [navigate])

  const fetchGames = useCallback(() => {
    const token    = localStorage.getItem('token')
    const statuses = TAB_STATUSES[tab] || []
    const qs       = statuses.map((s) => `status=${s}`).join('&')
    setLoading(true)
    fetch(`/api/games/user-games?${qs}`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => { setGames(data.user_games || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [tab])

  useEffect(() => { if (user) fetchGames() }, [user, fetchGames])

  if (!user) return null

  const addLabel = tab === 'Watchlist' ? 'Add to Watchlist' : 'Add to Library'

  return (
    <div style={s.page}>
      <Nav />
      <div style={s.body}>
        {!loading && (
          <div style={s.content}>
            <div style={s.grid}>
              {games.map((ug) => (
                <GameCard key={ug.user_game_id} ug={ug} />
              ))}
              <button style={s.emptyCard} onClick={() => setShowAddGame(true)}>
                <span style={s.emptyPlus}>+</span>
                <span style={s.emptyLabel}>{addLabel}</span>
              </button>
            </div>
          </div>
        )}

        {showAddGame && (
          <AddGameModal onClose={() => { setShowAddGame(false); fetchGames() }} />
        )}
      </div>
    </div>
  )
}

function GameCard({ ug }) {
  const { game, status } = ug
  return (
    <div style={s.card}>
      {game.icon_url
        ? <img src={game.icon_url} alt={game.title} style={s.cover} />
        : <div style={s.coverPlaceholder} />
      }
      <div style={s.cardBody}>
        <p style={s.cardTitle}>{game.title}</p>
        {game.release_year && <p style={s.cardMeta}>{game.release_year}</p>}
        <span style={s.badge}>{STATUS_LABEL[status] || status}</span>
      </div>
    </div>
  )
}


const s = {
  page:            { minHeight: '100vh', background: '#080808', fontFamily: 'system-ui, sans-serif' },
  body:            { display: 'flex', justifyContent: 'center', padding: '3rem 2rem' },
  content:         { width: '100%', maxWidth: 900, display: 'flex', flexDirection: 'column', gap: '1.5rem' },
  grid:            { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem' },
  card:            { background: '#111', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column' },
  cover:           { width: '100%', aspectRatio: '2/3', objectFit: 'cover' },
  coverPlaceholder:{ width: '100%', aspectRatio: '2/3', background: '#1e1e1e' },
  cardBody:        { padding: '0.6rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' },
  cardTitle:       { color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cardMeta:        { color: '#94a3b8', fontSize: '0.7rem', margin: 0 },
  badge:           { alignSelf: 'flex-start', background: '#2fd06a18', color: '#2fd06a', fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: 20, marginTop: '0.25rem' },
  emptyCard:       { background: 'none', border: '2px dashed #2a2a2a', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer', aspectRatio: '2/3', width: '100%' },
  emptyPlus:       { color: '#3a3a3a', fontSize: '1.75rem', lineHeight: 1 },
  emptyLabel:      { color: '#3a3a3a', fontSize: '0.75rem', fontFamily: 'system-ui, sans-serif', fontWeight: 600, textAlign: 'center', padding: '0 0.5rem' },
}
