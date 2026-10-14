import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export default function Login() {
  const navigate = useNavigate()
  const [form, setForm]     = useState({ email: '', password: '' })
  const [error, setError]   = useState('')
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
      <form style={s.card} onSubmit={handleSubmit}>
        <h1 style={s.brand}>GameBuddy</h1>
        <h2 style={s.heading}>Sign in</h2>

        {error && <p style={s.error}>{error}</p>}

        <label style={s.label}>Email</label>
        <input style={s.input} type="email" required autoComplete="email"
          value={form.email} onChange={set('email')} />

        <label style={s.label}>Password</label>
        <input style={s.input} type="password" required autoComplete="current-password"
          value={form.password} onChange={set('password')} />

        <button style={s.btn} type="submit" disabled={loading}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>

        <p style={s.foot}>
          No account? <Link to="/register" style={s.link}>Register</Link>
        </p>
      </form>
    </div>
  )
}

const s = {
  page:    { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f1a', fontFamily: 'system-ui, sans-serif' },
  card:    { background: '#1a1a2e', border: '1px solid #2d2d4e', borderRadius: 12, padding: '2.5rem', width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: '0.6rem' },
  brand:   { margin: 0, color: '#a78bfa', fontSize: '1.75rem', fontWeight: 700 },
  heading: { margin: '0 0 0.4rem', color: '#e2e8f0', fontWeight: 500, fontSize: '1.1rem' },
  label:   { color: '#94a3b8', fontSize: '0.85rem' },
  input:   { padding: '0.6rem 0.75rem', borderRadius: 6, border: '1px solid #2d2d4e', background: '#0f0f1a', color: '#e2e8f0', fontSize: '1rem', outline: 'none' },
  btn:     { marginTop: '0.5rem', padding: '0.75rem', borderRadius: 6, border: 'none', background: '#7c3aed', color: '#fff', fontSize: '1rem', fontWeight: 600, cursor: 'pointer' },
  error:   { color: '#f87171', margin: '0.25rem 0', fontSize: '0.875rem' },
  foot:    { color: '#94a3b8', textAlign: 'center', fontSize: '0.875rem', margin: 0 },
  link:    { color: '#a78bfa' },
}
