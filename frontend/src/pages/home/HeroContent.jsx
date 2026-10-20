import { Link } from 'react-router-dom'
import LaptopMockup from './LaptopMockup.jsx'

export default function HeroContent() {
  return (
    <div className="hero-inner" style={{ position: 'relative', zIndex: 3 }}>
      <div className="hero-text" style={{ position: 'relative' }}>
        <h1 style={h.headline}>
          <span style={h.meetLine}>Meet</span>
          <span style={h.gameLine}>
            <span style={h.gameWord}>Game</span><span style={h.buddyWord}>Buddy</span>
          </span>
        </h1>

        <p style={h.sub}>
          Discover games you'll love,{' '}
        track prices across every store
          , and manage your backlog.
        </p>

        <Link to="/register" style={h.cta}>Get Started →</Link>
      </div>

      <div className="hero-phone">
        <Blob style={{ width: 240, height: 240, top: '0%',   left: '0%',  animationDelay: '0s',   animationDuration: '6s' }} />
        <Blob style={{ width: 160, height: 160, bottom: '5%', right: '0%', animationDelay: '-3s',  animationDuration: '8s', background: 'radial-gradient(circle, rgba(90,50,255,0.18) 0%, transparent 70%)' }} />
        <Blob style={{ width: 90,  height: 90,  top: '55%',  left: '-5%', animationDelay: '-1.5s', animationDuration: '5s' }} />
        <LaptopMockup />
      </div>
    </div>
  )
}

function Blob({ style }) {
  return (
    <div
      className="gb-floating"
      style={{
        position: 'absolute',
        borderRadius: '50%',
        pointerEvents: 'none',
        background: 'radial-gradient(circle, rgba(47,208,106,0.2) 0%, transparent 70%)',
        animation: 'float 6s ease-in-out infinite',
        zIndex: 0,
        ...style,
      }}
    />
  )
}

const h = {
  headline: {
    position: 'relative',
    zIndex: 1,
    margin: '0 0 1.25rem',
    lineHeight: 1.0,
    letterSpacing: '-0.04em',
  },

  meetLine: {
    display: 'block',
    fontSize: 'clamp(1.1rem, 2vw, 1.6rem)',
    fontWeight: 500,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: '0.01em',
    marginBottom: '0.3rem',
  },

  gameLine: {
    display: 'block',
    fontSize: 'clamp(2.8rem, 5.5vw, 4.5rem)',
    fontWeight: 800,
    lineHeight: 1.0,
  },

  gameWord: {
    color: '#f0f4f8',
  },

  buddyWord: {
    background: 'linear-gradient(135deg, #a8ff78 0%, #2fd06a 55%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },

  sub: {
    position: 'relative',
    zIndex: 1,
    fontSize: 'clamp(0.95rem, 1.4vw, 1.1rem)',
    color: 'rgba(255,255,255,0.72)',
    lineHeight: 1.7,
    margin: '0 0 2rem',
    maxWidth: 400,
  },

  subBold: {
    color: '#fff',
    fontWeight: 700,
  },

  cta: {
    position: 'relative',
    zIndex: 1,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    background: '#2fd06a',
    color: '#03200e',
    fontWeight: 700,
    fontSize: '0.95rem',
    padding: '0.8rem 1.75rem',
    borderRadius: 100,
    textDecoration: 'none',
    letterSpacing: '-0.01em',
  },
}
