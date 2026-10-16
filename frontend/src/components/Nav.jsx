import { Link, useNavigate } from 'react-router-dom'

export default function Nav() {
  const navigate  = useNavigate()
  const user      = JSON.parse(localStorage.getItem('user') || 'null')

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  return (
    <nav style={s.nav}>
      <Link to="/" style={s.brand}>
        <img src="/logomark.png" alt="GameBuddy" style={s.brandIcon} />
      </Link>
      <div style={s.links}>
        {user ? (
          <>
            <Link to="/dashboard" style={s.link}>{user.username}</Link>
            <button style={s.btn} onClick={logout}>Sign out</button>
          </>
        ) : (
          <>
            <Link to="/login"    style={s.link}>Sign in</Link>
            <Link to="/register" style={s.cta}>Register</Link>
          </>
        )}
      </div>
    </nav>
  )
}

const s = {
  nav:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 2rem', background: 'transparent', position: 'sticky', top: 0, zIndex: 10 },
  brand:     { textDecoration: 'none', display: 'flex', alignItems: 'center' },
  brandIcon: { height: '2rem', width: 'auto', filter: 'drop-shadow(1px 0 0 white) drop-shadow(-1px 0 0 white) drop-shadow(0 1px 0 white) drop-shadow(0 -1px 0 white)' },
  links: { display: 'flex', alignItems: 'center', gap: '1rem' },
  link:  { color: '#94a3b8', textDecoration: 'none', fontSize: '0.9rem', fontFamily: 'system-ui, sans-serif' },
  cta:   { color: '#fff', background: '#2fd06a', padding: '0.4rem 0.9rem', borderRadius: 6, textDecoration: 'none', fontSize: '0.9rem', fontFamily: 'system-ui, sans-serif' },
  btn:   { color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', fontFamily: 'system-ui, sans-serif', padding: 0 },
}
