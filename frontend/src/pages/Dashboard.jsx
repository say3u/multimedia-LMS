import { useEffect, useState, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import Nav from '../components/Nav.jsx'
import AddGameModal from '../components/AddGameModal.jsx'
import WaveCanvas from '../components/WaveCanvas.jsx'
import DashboardControls from '../components/DashboardControls.jsx'

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
  const [searchParams, setSearchParams] = useSearchParams()
  const tab                  = searchParams.get('tab') || 'Watchlist'
  const [showAddGame, setShowAddGame] = useState(false)
  const [games, setGames]    = useState([])
  const [loading, setLoading] = useState(true)

  /* filter/sort state lives in URL so it survives refresh */
  const search            = searchParams.get('q') || ''
  const sort              = searchParams.get('sort') || 'recently_added'
  const selectedPlatforms = useMemo(() => {
    const p = searchParams.get('platform'); return p ? p.split(',') : []
  }, [searchParams])
  const filterSale        = searchParams.get('sale') === '1'

  const updateParams = useCallback((updates) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      Object.entries(updates).forEach(([k, v]) => {
        const empty = v === '' || v === null || v === false || (Array.isArray(v) && v.length === 0)
        if (empty) next.delete(k)
        else next.set(k, Array.isArray(v) ? v.join(',') : v === true ? '1' : String(v))
      })
      return next
    }, { replace: true })
  }, [setSearchParams])

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

  const onSaleCount = games.filter(g => g.price_info?.discount_percent > 0).length
  const possessive  = user.username?.endsWith('s') ? `${user.username}'` : `${user.username}'s`
  const emptyText   = tab === 'Watchlist' ? 'Add games to get price alerts.' : 'Add games to keep track of what you own.'

  const platformOptions = useMemo(() =>
    [...new Set(games.map(g => g.price_info?.platform).filter(Boolean))].sort()
      .map(p => ({ value: p, label: shortStore(p) }))
  , [games])

  const displayGames = useMemo(() => {
    let list = [...games]
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter(g => g.game.title.toLowerCase().includes(q))
    }
    if (filterSale)              list = list.filter(g => g.price_info?.discount_percent > 0)
    if (selectedPlatforms.length) list = list.filter(g => selectedPlatforms.includes(g.price_info?.platform))
    switch (sort) {
      case 'discount':   list.sort((a, b) => (b.price_info?.discount_percent || 0) - (a.price_info?.discount_percent || 0)); break
      case 'price_asc':  list.sort((a, b) => (a.price_info?.price ?? Infinity) - (b.price_info?.price ?? Infinity)); break
      case 'price_desc': list.sort((a, b) => (b.price_info?.price ?? -Infinity) - (a.price_info?.price ?? -Infinity)); break
      case 'name_asc':   list.sort((a, b) => a.game.title.localeCompare(b.game.title)); break
      default: break
    }
    return list
  }, [games, sort, filterSale, selectedPlatforms, search])

  const hasActiveFilters = !!search || filterSale || selectedPlatforms.length > 0
  const isFiltered = hasActiveFilters
  const subtext = games.length === 0
    ? emptyText
    : isFiltered
      ? `${displayGames.length} of ${games.length} games`
      : `${games.length} ${games.length === 1 ? 'game' : 'games'}${onSaleCount > 0 ? ` · ${onSaleCount} on sale` : ''}`

  const clearFilters = () => updateParams({ q: '', sale: false, platform: [] })

  return (
    <div style={s.page}>
      <div style={s.topWave}>
        <WaveCanvas wrapperStyle={s.waveLayer} />
        <div style={s.waveFade} />
        <Nav />
      </div>
      <div style={s.body}>
        {!loading && (
          <div style={s.content}>
            <div style={s.pageHeader}>
              <h1 style={s.headerTitle}>
                <span style={s.headerName}>{possessive}</span>
                {tab === 'Watchlist' ? ' Watchlist' : ' Library'}
              </h1>
              <p style={s.headerSub}>{subtext}</p>
            </div>
            <div style={s.controlsWrap}>
              <DashboardControls
                search={search}            onSearch={v => updateParams({ q: v })}
                sort={sort}                onSort={v => updateParams({ sort: v })}
                platformOptions={platformOptions}
                selectedPlatforms={selectedPlatforms}
                onPlatform={v => updateParams({ platform: v })}
                filterSale={filterSale}    onFilterSale={() => updateParams({ sale: !filterSale })}
                hasActiveFilters={hasActiveFilters}
                onClear={clearFilters}
              />
            </div>

            <div style={s.grid}>
              {displayGames.map((ug) => (
                <GameCard key={ug.user_game_id} ug={ug} />
              ))}
              {displayGames.length === 0 && games.length > 0 && (
                <div style={s.emptyState}>
                  <p style={s.emptyStateText}>No games match your filters</p>
                  <button style={s.emptyStateClear} onClick={clearFilters}>Clear filters</button>
                </div>
              )}
              {!hasActiveFilters && (
                <button style={s.emptyCard} onClick={() => setShowAddGame(true)}>
                  <span style={s.emptyPlus}>+</span>
                  <span style={s.emptyLabel}>{addLabel}</span>
                </button>
              )}
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

const STORE_SHORT = {
  'epic games store': 'Epic',
  'steam':            'Steam',
  'gog':              'GOG',
  'gog.com':          'GOG',
  'playstation store':'PS Store',
  'xbox':             'Xbox',
  'microsoft store':  'Xbox',
  'nintendo eshop':   'eShop',
  'humble store':     'Humble',
  'itch.io':          'itch.io',
}
function shortStore(name) {
  return STORE_SHORT[name?.toLowerCase()] ?? name
}

const EDITION_RE = [
  /(?:\s*[:\-–]\s*|\s+)(Director['']s Cut)$/i,
  /(?:\s*[:\-–]\s*|\s+)(Definitive Edition)$/i,
  /(?:\s*[:\-–]\s*|\s+)(The Final Cut)$/i,
  /(?:\s*[:\-–]\s*|\s+)(Complete Edition)$/i,
  /(?:\s*[:\-–]\s*|\s+)(Game of the Year Edition)$/i,
  /(?:\s*[:\-–]\s*|\s+)(GOTY Edition)$/i,
  /(?:\s*[:\-–]\s*|\s+)(Enhanced Edition)$/i,
  /(?:\s*[:\-–]\s*|\s+)(Remastered)$/i,
  /(?:\s*[:\-–]\s*|\s+)(Anniversary Edition)$/i,
]

function splitTitle(raw) {
  let title = raw
  let edition = null
  for (const re of EDITION_RE) {
    const m = title.match(re)
    if (m) {
      edition = toTitleCase(m[1])
      title = title.slice(0, m.index)
      break
    }
  }
  return { title: fixCase(title.trim()), edition }
}

const MINORS = new Set(['a','an','the','and','but','or','for','nor','on','at','to','by','in','of'])
function toTitleCase(str) {
  return str.toLowerCase().split(' ').map((w, i) =>
    i === 0 || !MINORS.has(w) ? w.charAt(0).toUpperCase() + w.slice(1) : w
  ).join(' ')
}
function fixCase(str) {
  return str === str.toUpperCase() ? toTitleCase(str) : str
}

function GameCard({ ug }) {
  const { game, status, price_info: p } = ug
  const { title, edition } = splitTitle(game.title)
  const [hovered, setHovered] = useState(false)
  const onSale = p?.discount_percent > 0
  const sym    = p?.currency === 'USD' ? '$' : (p?.currency ?? '')

  return (
    <div
      style={{ ...s.card, ...(hovered ? s.cardHover : {}) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={s.coverWrap}>
        {game.icon_url
          ? <img src={game.icon_url} alt={title} style={s.cover} />
          : <div style={s.coverPlaceholder} />
        }

      </div>

      <div style={s.cardBody}>
        <p style={s.cardTitle}>{title}</p>
        <p style={{ ...s.cardEdition, ...(edition ? {} : { visibility: 'hidden' }) }}>
          {edition || 'x'}
        </p>

        {p && (
          <div style={s.priceSection}>
            <div style={s.priceTop}>
              {onSale ? (
                <>
                  <span style={s.priceMain}>{sym}{p.price.toFixed(2)}</span>
                  <span style={s.priceOriginal}>{sym}{p.regular_price.toFixed(2)}</span>
                  <span style={s.discountBadge}>−{p.discount_percent}%</span>
                </>
              ) : (
                <span style={s.priceMuted}>{sym}{p.price.toFixed(2)}</span>
              )}
            </div>
            <div style={s.priceMeta}>
              {!onSale && p.historical_low && p.historical_low < p.price && (
                <span style={s.historicalLow}>Lowest: {sym}{p.historical_low.toFixed(2)}</span>
              )}
              <span style={s.priceStore}>on {shortStore(p.platform)}</span>
            </div>
          </div>
        )}

        {status !== 'want_to_play' && (
          <span style={s.badge}>{STATUS_LABEL[status] || status}</span>
        )}
      </div>
    </div>
  )
}


const s = {
  page:            { minHeight: '100vh', background: '#080808', fontFamily: 'system-ui, sans-serif' },
  topWave:         { position: 'relative', overflow: 'hidden', paddingBottom: '1.5rem' },
  waveLayer:       { pointerEvents: 'none', position: 'absolute', inset: '-4rem 0 0 0', bottom: 0, zIndex: 0, opacity: 0.28, mixBlendMode: 'screen', WebkitMaskImage: 'linear-gradient(180deg, black 0%, black 60%, transparent 100%)', maskImage: 'linear-gradient(180deg, black 0%, black 60%, transparent 100%)' },
  waveFade:        { pointerEvents: 'none', position: 'absolute', inset: 0, zIndex: 1, background: 'linear-gradient(180deg, rgba(8,8,8,0) 40%, rgba(8,8,8,1) 100%)' },
  body:            { padding: '1.25rem 4rem 3rem' },
  content:         { display: 'flex', flexDirection: 'column', gap: '1.5rem' },
  controlsWrap:    { marginBottom: '1.5rem' },
  pageHeader:      { display: 'flex', flexDirection: 'column', gap: '0.3rem', marginBottom: '2rem' },
  emptyState:      { gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '4rem 2rem', color: 'rgba(255,255,255,0.4)', fontFamily: 'system-ui, sans-serif' },
  emptyStateText:  { fontSize: '0.95rem', margin: 0 },
  emptyStateClear: { background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8, padding: '0.4rem 1rem', color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', fontFamily: 'system-ui, sans-serif', cursor: 'pointer' },
  headerTitle:     { fontSize: 28, fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.2, fontFamily: 'system-ui, sans-serif' },
  headerName:      { color: '#2fd06a' },
  headerSub:       { fontSize: 14, color: 'rgba(255,255,255,0.45)', margin: 0, fontFamily: 'system-ui, sans-serif' },
  grid:            { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1.25rem' },
  card:            { background: '#111', borderRadius: 10, overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid transparent', transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease', cursor: 'pointer' },
  cardHover:       { transform: 'translateY(-4px)', boxShadow: '0 6px 20px rgba(47,208,106,0.08)', borderColor: 'rgba(47,208,106,0.15)' },
  coverWrap:       { position: 'relative' },
  cover:           { width: '100%', aspectRatio: '2/3', objectFit: 'cover', display: 'block' },
  coverPlaceholder:{ width: '100%', aspectRatio: '2/3', background: '#1e1e1e' },
  cardBody:        { padding: '0.6rem 0.75rem', display: 'flex', flexDirection: 'column', gap: '0.15rem', flex: 1 },
  cardTitle:       { color: '#e2e8f0', fontSize: '0.8rem', fontWeight: 600, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  cardEdition:     { color: 'rgba(255,255,255,0.28)', fontSize: '0.68rem', fontWeight: 500, margin: 0, minHeight: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  priceSection:    { borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '0.35rem', paddingTop: '0.4rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' },
  priceTop:        { display: 'flex', alignItems: 'baseline', gap: '0.4rem', flexWrap: 'wrap' },
  priceMain:       { fontSize: '1.15rem', fontWeight: 800, color: '#2fd06a', fontVariantNumeric: 'tabular-nums', lineHeight: 1 },
  priceMuted:      { fontSize: '1.15rem', fontWeight: 800, color: '#e2e8f0', fontVariantNumeric: 'tabular-nums', lineHeight: 1 },
  priceOriginal:   { fontSize: '0.7rem', fontWeight: 500, color: 'rgba(255,255,255,0.3)', textDecoration: 'line-through', fontVariantNumeric: 'tabular-nums' },
  discountBadge:   { fontSize: '0.6rem', fontWeight: 800, color: '#052e16', background: '#2fd06a', borderRadius: 5, padding: '1px 5px' },
  priceMeta:       { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  historicalLow:   { fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)', fontVariantNumeric: 'tabular-nums' },
  priceStore:      { fontSize: '0.62rem', color: 'rgba(255,255,255,0.3)' },
  badge:           { alignSelf: 'flex-start', background: '#2fd06a18', color: '#2fd06a', fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.5rem', borderRadius: 20, marginTop: '0.25rem' },
  emptyCard:       { background: 'none', border: '2px dashed #2a2a2a', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer', aspectRatio: '2/3', width: '100%' },
  emptyPlus:       { color: '#3a3a3a', fontSize: '1.75rem', lineHeight: 1 },
  emptyLabel:      { color: '#3a3a3a', fontSize: '0.75rem', fontFamily: 'system-ui, sans-serif', fontWeight: 600, textAlign: 'center', padding: '0 0.5rem' },
}
