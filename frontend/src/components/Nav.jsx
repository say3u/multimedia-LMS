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
      <Link to="/" style={s.brand}>GameBuddy</Link>
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
  nav:   { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 2rem', background: '#1a1a2e', borderBottom: '1px solid #2d2d4e', position: 'sticky', top: 0, zIndex: 10 },
  brand: { color: '#a78bfa', fontWeight: 700, fontSize: '1.25rem', textDecoration: 'none', fontFamily: 'system-ui, sans-serif' },
  links: { display: 'flex', alignItems: 'center', gap: '1rem' },
  link:  { color: '#94a3b8', textDecoration: 'none', fontSize: '0.9rem', fontFamily: 'system-ui, sans-serif' },
  cta:   { color: '#fff', background: '#7c3aed', padding: '0.4rem 0.9rem', borderRadius: 6, textDecoration: 'none', fontSize: '0.9rem', fontFamily: 'system-ui, sans-serif' },
  btn:   { color: '#94a3b8', background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', fontFamily: 'system-ui, sans-serif', padding: 0 },
}
