import { Link } from 'react-router-dom'

export default function FinalCTA() {
  return (
    <section style={{ background: '#000', padding: '4rem 2rem 6rem', display: 'flex', justifyContent: 'center' }}>
      <Link
        to="/register"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: '#2fd06a',
          color: '#03200e',
          fontWeight: 700,
          fontSize: '1rem',
          padding: '0.9rem 2.25rem',
          borderRadius: 100,
          textDecoration: 'none',
        }}
      >
        Sign up →
      </Link>
    </section>
  )
}
