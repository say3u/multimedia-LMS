import { Link } from 'react-router-dom'
import LaptopMockup from './LaptopMockup.jsx'
import { COPY } from './config.js'

export default function HeroContent() {
  return (
    <div className="hero-inner" style={{ position: 'relative', zIndex: 3 }}>
      <div className="hero-text">
        <h1 style={h.headline}>
          <span style={{ display: 'block' }}>Meet</span>
          <span style={{ color: '#f0f4f8' }}>Game</span><span style={{ color: '#2fd06a' }}>Buddy</span>
        </h1>
        <p style={h.sub}>{COPY.hero.sub}</p>
        <Link to="/register" style={h.cta}>{COPY.hero.cta} →</Link>
      </div>

      <div className="hero-phone">
        <Blob style={{ width: 240, height: 240, top: '0%', left: '0%',  animationDelay: '0s',  animationDuration: '6s' }} />
        <Blob style={{ width: 160, height: 160, bottom: '5%', right: '0%', animationDelay: '-3s', animationDuration: '8s', background: 'radial-gradient(circle, rgba(90,50,255,0.18) 0%, transparent 70%)' }} />
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
    fontSize: 'clamp(2.4rem, 4.5vw, 3.75rem)',
    fontWeight: 800,
    lineHeight: 1.1,
    letterSpacing: '-0.03em',
    color: '#f0f4f8',
    margin: '0 0 1.25rem',
  },
  sub: {
    fontSize: 'clamp(0.95rem, 1.4vw, 1.1rem)',
    color: 'rgba(255,255,255,0.52)',
    lineHeight: 1.75,
    margin: '0 0 2rem',
    maxWidth: 460,
  },
  cta: {
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
