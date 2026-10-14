import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm]       = useState({ username: '', email: '', password: '', confirm: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.password !== form.confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      const res  = await fetch('/api/auth/register', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ username: form.username, email: form.email, password: form.password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Registration failed'); return }
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
        <h2 style={s.heading}>Create account</h2>

        {error && <p style={s.error}>{error}</p>}

        <label style={s.label}>Username</label>
        <input style={s.input} type="text" required minLength={3} maxLength={50} autoComplete="username"
          value={form.username} onChange={set('username')} />

        <label style={s.label}>Email</label>
        <input style={s.input} type="email" required autoComplete="email"
          value={form.email} onChange={set('email')} />

        <label style={s.label}>Password <span style={s.hint}>(min 8 characters)</span></label>
        <input style={s.input} type="password" required minLength={8} autoComplete="new-password"
          value={form.password} onChange={set('password')} />

        <label style={s.label}>Confirm password</label>
        <input style={s.input} type="password" required autoComplete="new-password"
          value={form.confirm} onChange={set('confirm')} />

        <button style={s.btn} type="submit" disabled={loading}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>

        <p style={s.foot}>
          Already have an account? <Link to="/login" style={s.link}>Sign in</Link>
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
  hint:    { color: '#64748b', fontSize: '0.75rem' },
  input:   { padding: '0.6rem 0.75rem', borderRadius: 6, border: '1px solid #2d2d4e', background: '#0f0f1a', color: '#e2e8f0', fontSize: '1rem', outline: 'none' },
  btn:     { marginTop: '0.5rem', padding: '0.75rem', borderRadius: 6, border: 'none', background: '#7c3aed', color: '#fff', fontSize: '1rem', fontWeight: 600, cursor: 'pointer' },
  error:   { color: '#f87171', margin: '0.25rem 0', fontSize: '0.875rem' },
  foot:    { color: '#94a3b8', textAlign: 'center', fontSize: '0.875rem', margin: 0 },
  link:    { color: '#a78bfa' },
}
