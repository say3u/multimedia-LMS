import { COPY } from './config.js'
import { useScrollReveal } from './useScrollReveal.js'
import {
  IntegrationsVisual,
  MarqueeVisual,
  BadgesVisual,
  NotificationVisual,
  MemoryVisual,
} from './FeatureVisuals.jsx'

const VISUALS = {
  integrations: IntegrationsVisual,
  marquee:      MarqueeVisual,
  badges:       BadgesVisual,
  notification: NotificationVisual,
  memory:       MemoryVisual,
}

export default function FeaturesSection() {
  return (
    <section style={{ background: '#000', padding: '2rem 0 0' }}>
      <div className="feature-wrap">
        {COPY.features.map((feat, i) => (
          <FeatureBlock key={feat.id} feat={feat} reverse={i % 2 === 1} />
        ))}
      </div>
    </section>
  )
}

function FeatureBlock({ feat, reverse }) {
  const [ref, visible] = useScrollReveal()
  const Visual = VISUALS[feat.visual]

  return (
    <article
      ref={ref}
      className={`feature-block${reverse ? ' reverse' : ''} reveal${visible ? ' visible' : ''}`}
    >
      <div className="feature-text">
        <h3 style={fs.headline}>{feat.headline}</h3>
        <p style={fs.desc}>{feat.desc}</p>
        <ul style={fs.list}>
          {feat.benefits.map(b => (
            <li key={b} style={fs.item}>
              <span style={fs.dot} aria-hidden="true">●</span>
              {b}
            </li>
          ))}
        </ul>
      </div>

      <div className="feature-visual-wrap">
        <Visual />
      </div>
    </article>
  )
}

const fs = {
  headline: {
    fontSize: 'clamp(1.5rem, 2.4vw, 2rem)',
    fontWeight: 700,
    color: '#f0f4f8',
    margin: '0 0 0.85rem',
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
  },
  desc: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: '1rem',
    lineHeight: 1.75,
    margin: '0 0 1.5rem',
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.6rem',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    color: 'rgba(255,255,255,0.72)',
    fontSize: '0.9rem',
  },
  dot: { color: '#2fd06a', fontSize: 7, flexShrink: 0 },
}
