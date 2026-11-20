import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useLocation, useSearchParams } from 'react-router-dom'

const TABS = ['Watchlist', 'My Library']

export default function Nav() {
  const navigate          = useNavigate()
  const { pathname }      = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const user              = JSON.parse(localStorage.getItem('user') || 'null')
  const [open, setOpen]   = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const menuRef           = useRef(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const onDashboard = pathname === '/dashboard'
  const activeTab   = searchParams.get('tab') || 'Watchlist'

  const setTab = (t) => setSearchParams({ tab: t })

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  useEffect(() => {
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : '?'

  return (
    <nav style={{ ...s.nav, ...(scrolled ? s.navScrolled : {}) }}>
      <div style={s.left}>
        <Link to={user ? '/dashboard' : '/'} style={s.brand}>
          <img src="/logomark.png" alt="GameBuddy" style={s.brandIcon} />
        </Link>
        {user && (
          <div style={s.tabs}>
            {/* phase 2 pages, on every page when signed in */}
            <Link to="/browse" style={{ ...s.tabBtn, ...s.navLink, ...(pathname === '/browse' ? s.tabActive : {}) }}>Browse</Link>
            <Link to="/feed" style={{ ...s.tabBtn, ...s.navLink, ...(pathname === '/feed' ? s.tabActive : {}) }}>Feed</Link>
          </div>
        )}
        {user && onDashboard && (
          <div style={s.tabs}>
            {TABS.map((t) => (
              <button
                key={t}
                style={{ ...s.tabBtn, ...(activeTab === t ? s.tabActive : {}) }}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={s.links}>
        {user ? (
          <div style={s.profileWrap} ref={menuRef}>
            <button style={s.avatar} onClick={() => setOpen((v) => !v)} aria-label="User menu">
              {initials}
            </button>
            {open && (
              <div style={s.dropdown}>
                <span style={s.dropName}>{user.username}</span>
                <hr style={s.divider} />
                <Link to="/dashboard" style={{ ...s.dropBtn, textDecoration: 'none' }} onClick={() => setOpen(false)}>My games</Link>
                <Link to={`/u/${user.username}`} style={{ ...s.dropBtn, textDecoration: 'none' }} onClick={() => setOpen(false)}>My profile</Link>
                <Link to="/games/new" style={{ ...s.dropBtn, textDecoration: 'none' }} onClick={() => setOpen(false)}>Add a game</Link>
                <hr style={s.divider} />
                <button style={s.dropBtn} onClick={logout}>Sign out</button>
              </div>
            )}
          </div>
        ) : (
          <>
            <Link to="/about" style={s.link}>About Us</Link>
            <Link to="/login" style={s.cta}>Sign in</Link>
          </>
        )}
      </div>
    </nav>
  )
}


const s = {
  nav:       { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 2rem', background: 'transparent', position: 'sticky', top: 0, zIndex: 10, transition: 'background 0.2s ease, backdrop-filter 0.2s ease, box-shadow 0.2s ease', isolation: 'isolate' },
  navScrolled: { background: 'rgba(8,8,8,0.85)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', boxShadow: '0 1px 0 rgba(255,255,255,0.06)' },
  left:      { display: 'flex', alignItems: 'center', gap: '2rem' },
  brand:     { textDecoration: 'none', display: 'flex', alignItems: 'center' },
  tabs:      { display: 'flex', gap: '0.25rem' },
  tabBtn:    { background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '0.9rem', fontFamily: 'system-ui, sans-serif', fontWeight: 600, padding: '0.4rem 0.75rem', borderRadius: 6 },
  tabActive: { color: '#2fd06a', background: '#2fd06a18' },
  navLink:   { textDecoration: 'none', display: 'inline-block' },
  brandIcon: { height: '2rem', width: 'auto', filter: 'drop-shadow(1px 0 0 white) drop-shadow(-1px 0 0 white) drop-shadow(0 1px 0 white) drop-shadow(0 -1px 0 white)' },
  links:     { display: 'flex', alignItems: 'center', gap: '1rem' },
  link:      { color: '#94a3b8', textDecoration: 'none', fontSize: '0.9rem', fontFamily: 'system-ui, sans-serif', fontWeight: 700 },
  cta:       { color: '#080808', background: '#2fd06a', padding: '0.4rem 0.9rem', borderRadius: 6, textDecoration: 'none', fontSize: '0.9rem', fontFamily: 'system-ui, sans-serif', fontWeight: 700 },
  profileWrap: { position: 'relative' },
  avatar:    { width: 36, height: 36, borderRadius: '50%', background: '#2fd06a', color: '#080808', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.8rem', fontFamily: 'system-ui, sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  dropdown:  { position: 'absolute', right: 0, top: 'calc(100% + 8px)', background: '#1a1a1a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '0.75rem 1rem', minWidth: 160, display: 'flex', flexDirection: 'column', gap: '0.5rem', boxShadow: '0 4px 16px rgba(0,0,0,0.5)' },
  dropName:  { color: '#e2e8f0', fontSize: '0.9rem', fontFamily: 'system-ui, sans-serif', fontWeight: 600, whiteSpace: 'nowrap' },
  divider:   { border: 'none', borderTop: '1px solid #2a2a2a', margin: 0 },
  dropBtn:   { color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontFamily: 'system-ui, sans-serif', padding: 0, textAlign: 'left' },
}
