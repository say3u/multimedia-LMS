import { Link } from 'react-router-dom'
import WaveCanvas from './WaveCanvas.jsx'

const LINKS = {
  Product: [
    { label: 'Features',  to: '/#features' },
    { label: 'Pricing',   to: '/#pricing'  },
  ],
  Account: [
    { label: 'Sign up',  to: '/register' },
    { label: 'Sign in',  to: '/login'    },
  ],
  Legal: [
    { label: 'Privacy',  to: '/privacy' },
    { label: 'Terms',    to: '/terms'   },
  ],
}

export default function Footer() {
  return (
    <footer style={f.footer}>
      <WaveCanvas wrapperStyle={f.wave} />
      <div style={f.inner}>

        {/* Brand */}
        <div style={f.brand}>
          <Link to="/" style={f.logoLink}>
            <img src="/logomark.png" alt="GameBuddy" style={f.logoImg} />
            <span style={f.logoName}>GameBuddy</span>
          </Link>
        </div>

        {/* Link columns */}
        <div style={f.cols}>
          {Object.entries(LINKS).map(([group, items]) => (
            <div key={group} style={f.col}>
              <span style={f.colHead}>{group}</span>
              {items.map(item => (
                <Link key={item.label} to={item.to} style={f.link}>{item.label}</Link>
              ))}
            </div>
          ))}
        </div>

      </div>

      <div style={f.bottom}>
        <span style={f.copy}>© {new Date().getFullYear()} GameBuddy. All rights reserved.</span>
      </div>
    </footer>
  )
}

const f = {
  wave: {
    pointerEvents: 'none',
    position: 'absolute',
    inset: '0 0 -4rem 0',
    zIndex: 0,
    opacity: 0.3,
    mixBlendMode: 'screen',
    WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, black 70%, black 100%)',
    maskImage: 'linear-gradient(180deg, transparent 0%, black 70%, black 100%)',
  },
  footer: {
    background: '#000',
    borderTop: '1px solid rgba(255,255,255,0.06)',
    position: 'relative',
    isolation: 'isolate',
    overflow: 'hidden',
    fontFamily: 'system-ui, sans-serif',
    color: '#fff',
    padding: '7rem 2rem 2rem',
  },
  inner: {
    position: 'relative',
    zIndex: 1,
    maxWidth: 1200,
    margin: '0 auto',
    display: 'flex',
    justifyContent: 'space-between',
    gap: '2rem',
    flexWrap: 'wrap',
    paddingBottom: '2.5rem',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  brand: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
    maxWidth: 220,
  },
  logoLink: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    textDecoration: 'none',
  },
  logoImg: {
    height: '1.6rem',
    width: 'auto',
    filter: 'drop-shadow(1px 0 0 white) drop-shadow(-1px 0 0 white) drop-shadow(0 1px 0 white) drop-shadow(0 -1px 0 white)',
  },
  logoName: {
    color: '#fff',
    fontWeight: 700,
    fontSize: '1rem',
  },
  cols: {
    display: 'flex',
    gap: '3rem',
    flexWrap: 'wrap',
  },
  col: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
  },
  colHead: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: '0.2rem',
  },
  link: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: '0.875rem',
    textDecoration: 'none',
  },
  bottom: {
    position: 'relative',
    zIndex: 1,
    maxWidth: 1200,
    margin: '0 auto',
    paddingTop: '1.5rem',
  },
  copy: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: '0.8rem',
  },
}
