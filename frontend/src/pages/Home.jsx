import { useEffect, useState } from 'react'
import Nav from '../components/Nav.jsx'

export default function Home() {
  const [games,   setGames]   = useState([])
  const [query,   setQuery]   = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const params = query ? `?q=${encodeURIComponent(query)}` : ''
    fetch(`/api/games${params}`)
      .then(r => r.json())
      .then(d => setGames(d.games || []))
      .finally(() => setLoading(false))
  }, [query])

  return (
    <div style={s.page}>
      <Nav />

      <div style={s.hero}>
        <h1 style={s.heading}>Browse Games</h1>
        <input
          style={s.search}
          type="search"
          placeholder="Search by title…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      <main style={s.main}>
        {loading && <p style={s.msg}>Loading…</p>}

        {!loading && games.length === 0 && (
          <div style={s.empty}>
            <p style={s.emptyTitle}>No games yet</p>
            <p style={s.emptyMsg}>The database is empty. Add games via the import script or the admin panel.</p>
          </div>
        )}

        <div style={s.grid}>
          {games.map(game => (
            <GameCard key={game.game_id} game={game} />
          ))}
        </div>
      </main>
    </div>
  )
}

function GameCard({ game }) {
  return (
    <div style={s.card}>
      <div style={s.thumb}>
        {game.icon_url
          ? <img src={game.icon_url} alt={game.title} style={s.img} />
          : <div style={s.placeholder}>{game.title.charAt(0)}</div>
        }
      </div>
      <div style={s.info}>
        <p style={s.title}>{game.title}</p>
        <p style={s.meta}>
          {[game.genre, game.release_year].filter(Boolean).join(' · ')}
        </p>
      </div>
    </div>
  )
}

const s = {
  page:         { minHeight: '100vh', background: '#0f0f1a', fontFamily: 'system-ui, sans-serif' },
  hero:         { padding: '2.5rem 2rem 1.5rem', maxWidth: 1200, margin: '0 auto' },
  heading:      { color: '#e2e8f0', fontSize: '1.75rem', fontWeight: 700, margin: '0 0 1rem' },
  search:       { width: '100%', maxWidth: 400, padding: '0.6rem 0.9rem', borderRadius: 8, border: '1px solid #2d2d4e', background: '#1a1a2e', color: '#e2e8f0', fontSize: '1rem', outline: 'none', boxSizing: 'border-box' },
  main:         { padding: '0 2rem 3rem', maxWidth: 1200, margin: '0 auto' },
  msg:          { color: '#64748b', textAlign: 'center', marginTop: '4rem' },
  empty:        { textAlign: 'center', marginTop: '5rem' },
  emptyTitle:   { color: '#e2e8f0', fontSize: '1.25rem', margin: '0 0 0.5rem' },
  emptyMsg:     { color: '#64748b', fontSize: '0.9rem' },
  grid:         { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem', marginTop: '1.5rem' },
  card:         { background: '#1a1a2e', border: '1px solid #2d2d4e', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', transition: 'border-color 0.15s' },
  thumb:        { width: '100%', aspectRatio: '1', background: '#0f0f1a', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  img:          { width: '100%', height: '100%', objectFit: 'cover' },
  placeholder:  { fontSize: '2.5rem', color: '#a78bfa', fontWeight: 700 },
  info:         { padding: '0.6rem 0.75rem' },
  title:        { color: '#e2e8f0', fontSize: '0.875rem', fontWeight: 600, margin: '0 0 0.2rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  meta:         { color: '#64748b', fontSize: '0.75rem', margin: 0 },
}
