import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Nav from '../components/Nav.jsx'

export default function Dashboard() {
  const navigate     = useNavigate()
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user') || 'null'))

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

  if (!user) return null

  return (
    <div style={s.page}>
      <Nav />
      <div style={s.body}>
        <div style={s.card}>
          <p style={s.welcome}>
            Welcome back, <strong style={s.accent}>{user.username}</strong>!
          </p>
          <div style={s.info}>
            <Row label="Email"        value={user.email} />
            <Row label="Member since" value={new Date(user.created_at).toLocaleDateString()} />
            <Row label="User ID"      value={`#${user.user_id}`} />
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #2d2d4e' }}>
      <span style={{ color: '#94a3b8', fontSize: '0.875rem' }}>{label}</span>
      <span style={{ color: '#e2e8f0', fontSize: '0.875rem' }}>{value}</span>
    </div>
  )
}

const s = {
  page:    { minHeight: '100vh', background: '#0f0f1a', fontFamily: 'system-ui, sans-serif' },
  body:    { display: 'flex', justifyContent: 'center', padding: '3rem 2rem' },
  card:    { background: '#1a1a2e', border: '1px solid #2d2d4e', borderRadius: 12, padding: '2.5rem', width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: '1rem' },
  welcome: { color: '#e2e8f0', margin: 0, fontSize: '1.05rem' },
  accent:  { color: '#a78bfa' },
  info:    { display: 'flex', flexDirection: 'column' },
}
