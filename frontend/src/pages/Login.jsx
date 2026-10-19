import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Nav from '../components/Nav.jsx'
import WaveCanvas from '../components/WaveCanvas.jsx'

export default function Login() {
  const navigate = useNavigate()
  const [form, setForm]       = useState({ email: '', password: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res  = await fetch('/api/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Login failed'); return }
      localStorage.setItem('token', data.token)
      localStorage.setItem('user',  JSON.stringify(data.user))
      navigate('/dashboard')
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.page}>
      <WaveCanvas wrapperStyle={s.wave} />
      <Nav />
      <div style={s.content}>
        <form style={s.card} onSubmit={handleSubmit}>

          {/* Brand */}
          <div style={s.brandRow}>
            <img src="/logomark.png" alt="GameBuddy" style={s.logo} />
            <span style={s.brandName}>GameBuddy</span>
          </div>

          <h1 style={s.heading}>Welcome back</h1>
          <p style={s.sub}>Sign in to your account to continue</p>

          {error && <p style={s.error}>{error}</p>}

          <div style={s.fields}>
            <div style={s.field}>
              <label style={s.label}>Email</label>
              <input style={s.input} type="email" required autoComplete="email"
                placeholder="you@example.com"
                value={form.email} onChange={set('email')} />
            </div>

            <div style={s.field}>
              <label style={s.label}>Password</label>
              <input style={s.input} type="password" required autoComplete="current-password"
                placeholder="••••••••"
                value={form.password} onChange={set('password')} />
            </div>
          </div>

          <button style={{ ...s.btn, opacity: loading ? 0.7 : 1 }} type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in →'}
          </button>

          <p style={s.foot}>
            No account?{' '}
            <Link to="/register" style={s.link}>Create one</Link>
          </p>

        </form>
      </div>
    </div>
  )
}

const s = {
  page:     { minHeight: '100vh', display: 'flex', flexDirection: 'column', background: '#080808', fontFamily: 'system-ui, sans-serif', position: 'relative', isolation: 'isolate', overflow: 'hidden' },
  wave:     { position: 'absolute', inset: '-4rem 0 0 0', height: '280px', zIndex: 0, opacity: 0.34, mixBlendMode: 'screen', WebkitMaskImage: 'linear-gradient(180deg, black 0%, black 40%, transparent 100%)', maskImage: 'linear-gradient(180deg, black 0%, black 40%, transparent 100%)', pointerEvents: 'none' },
  content:  { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', position: 'relative', zIndex: 1 },

  card:     { width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: '1.25rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '2.5rem', backdropFilter: 'blur(20px)' },

  brandRow: { display: 'flex', alignItems: 'center', gap: '0.5rem' },
  logo:     { height: '1.75rem', width: 'auto', filter: 'drop-shadow(1px 0 0 white) drop-shadow(-1px 0 0 white) drop-shadow(0 1px 0 white) drop-shadow(0 -1px 0 white)' },
  brandName:{ color: '#fff', fontWeight: 700, fontSize: '1rem' },

  heading:  { margin: 0, color: '#f0f4f8', fontSize: '1.65rem', fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.2 },
  sub:      { margin: 0, color: 'rgba(255,255,255,0.4)', fontSize: '0.875rem' },

  error:    { color: '#f87171', fontSize: '0.85rem', margin: 0, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '0.6rem 0.8rem' },

  fields:   { display: 'flex', flexDirection: 'column', gap: '0.85rem' },
  field:    { display: 'flex', flexDirection: 'column', gap: '0.4rem' },
  label:    { color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', fontWeight: 500 },
  input:    { padding: '0.75rem 1rem', borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.04)', color: '#e2e8f0', fontSize: '0.95rem', outline: 'none', transition: 'border-color 0.15s' },

  btn:      { padding: '0.85rem', borderRadius: 100, border: 'none', background: '#2fd06a', color: '#03200e', fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', letterSpacing: '-0.01em', transition: 'opacity 0.15s' },

  foot:     { color: 'rgba(255,255,255,0.35)', textAlign: 'center', fontSize: '0.85rem', margin: 0 },
  link:     { color: '#2fd06a', textDecoration: 'none', fontWeight: 500 },
}
