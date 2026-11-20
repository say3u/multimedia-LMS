import Nav          from '../components/Nav.jsx'
import Footer        from '../components/Footer.jsx'
import WaveCanvas    from '../components/WaveCanvas.jsx'
import HeroContent   from './home/HeroContent.jsx'
import FeaturesSection from './home/FeaturesSection.jsx'
import FinalCTA      from './home/FinalCTA.jsx'
import './home/home.css'

export default function Home() {

  return (
    <main style={{ background: '#000', fontFamily: 'system-ui, sans-serif', color: '#fff' }}>
      {/* ── Hero ── */}
      <section style={s.hero}>
        <WaveCanvas wrapperStyle={s.waveLayer} />
        <div style={s.vignette} />
        <div style={s.navWrapper}><Nav /></div>
        <HeroContent />
      </section>

      <FeaturesSection />
      <FinalCTA />
      <Footer />
    </main>
  )
}

const s = {
  hero: {
    position: 'relative',
    width: '100%',
    minHeight: '100vh',
    background: '#000',
    overflow: 'hidden',
  },
  navWrapper: {
    position: 'relative',
    zIndex: 10,
  },
  waveLayer: {
    pointerEvents: 'none',
    position: 'absolute',
    inset: '-6rem 0 0 0',
    bottom: 0,
    zIndex: 1,
    opacity: 0.34,
    mixBlendMode: 'screen',
    WebkitMaskImage: 'linear-gradient(180deg, black 0%, black 62%, transparent 98%)',
    maskImage: 'linear-gradient(180deg, black 0%, black 62%, transparent 98%)',
  },
  vignette: {
    pointerEvents: 'none',
    position: 'absolute',
    inset: 0,
    zIndex: 2,
    background: 'radial-gradient(ellipse at 22% 26%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.42) 58%, rgba(0,0,0,0.86) 100%)',
  },
}
