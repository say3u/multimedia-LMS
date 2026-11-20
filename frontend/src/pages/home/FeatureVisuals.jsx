import { useEffect, useState } from 'react'

const STICKER = [
  'drop-shadow(-3px 0 0 #fff)',
  'drop-shadow(3px 0 0 #fff)',
  'drop-shadow(0 -3px 0 #fff)',
  'drop-shadow(0 3px 0 #fff)',
  'drop-shadow(-2px -2px 0 #fff)',
  'drop-shadow(2px -2px 0 #fff)',
  'drop-shadow(-2px 2px 0 #fff)',
  'drop-shadow(2px 2px 0 #fff)',
  'drop-shadow(0 8px 18px rgba(0,0,0,0.5))',
].join(' ')

function Mascot({ src, side = 'right', rotate = 10 }) {
  return (
    <img
      src={src}
      alt=""
      aria-hidden="true"
      style={{
        position: 'absolute',
        bottom: '-20px',
        [side]: '-20px',
        width: '115px',
        transform: `rotate(${rotate}deg)`,
        filter: STICKER,
        pointerEvents: 'none',
        zIndex: 5,
      }}
    />
  )
}

const REDUCE =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* ── a. Integration grid ─────────────────────────────── */
const ICONIFY = 'https://api.iconify.design'

const STORES = [
  { name: 'Steam',       color: '#1a9fff', logo: `${ICONIFY}/simple-icons:steam.svg?color=white` },
  { name: 'Epic Games',  color: '#2a2a2a', logo: `${ICONIFY}/simple-icons:epicgames.svg?color=white` },
  { name: 'PlayStation', color: '#003eb3', logo: `${ICONIFY}/simple-icons:playstation.svg?color=white` },
  { name: 'Xbox',        color: '#107c10', logo: `${ICONIFY}/mdi:microsoft-xbox.svg?color=white` },
  { name: 'GOG',         color: '#86328a', logo: `${ICONIFY}/simple-icons:gogdotcom.svg?color=white` },
]

export function IntegrationsVisual() {
  return (
    <div style={{ ...v.card, position: 'relative' }}>
      <Mascot src="/mascot_1_platforms.png" side="right" rotate={-10} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>

        {/* Store list */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {STORES.map(s => (
            <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: '8px 12px' }}>
              <div style={{ width: 30, height: 30, borderRadius: 8, background: s.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <img src={s.logo} alt={s.name} style={{ width: 17, height: 17, objectFit: 'contain' }} />
              </div>
              <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 500 }}>{s.name}</span>
              <div style={{ marginLeft: 'auto', width: 6, height: 6, borderRadius: '50%', background: '#2fd06a', flexShrink: 0 }} />
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, borderRadius: 10, padding: '6px 12px' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {['#5865f2','#9146ff','#e91e1e','#ff6b00'].map(c => (
                <div key={c} style={{ width: 16, height: 16, borderRadius: 5, background: c, opacity: 0.7 }} />
              ))}
            </div>
            <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>+ 10 more</span>
          </div>
        </div>

        {/* Connector */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, color: 'rgba(47,208,106,0.4)', fontSize: 10, userSelect: 'none' }}>
          {'→→→'.split('').map((c, i) => <span key={i}>{c}</span>)}
        </div>

        {/* GameBuddy hub */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <div style={{ width: 54, height: 54, borderRadius: 16, background: '#2fd06a', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 24px rgba(47,208,106,0.35)' }}>
            <img src="/logomark.png" alt="GameBuddy" style={{ width: 34, height: 34, objectFit: 'contain' }} />
          </div>
          <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em' }}>GameBuddy</span>
        </div>

      </div>
    </div>
  )
}

/* ── b. Price drop list ──────────────────────────────── */
const DEALS = [
  { title: 'Elden Ring',          original: 59.99, sale: 23.99, pct: 60, store: 'Steam'    },
  { title: 'Cyberpunk 2077',      original: 59.99,  sale: 8.99,  pct: 85, store: 'GOG'      },
  { title: "Baldur's Gate 3",     original: 59.99, sale: 47.99, pct: 20, store: 'Steam'    },
  { title: 'Red Dead Redemption 2', original: 59.99, sale: 11.99, pct: 80, store: 'Epic'   },
]

export function MarqueeVisual() {
  return (
    <div style={{ ...v.card, position: 'relative', display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: '4.5rem' }}>
      <Mascot src="/mascot_2_deals.png" side="left" rotate={12} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
        <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Today's Deals</span>
        <span style={{ color: '#2fd06a', fontSize: 10, fontWeight: 600 }}>Live prices</span>
      </div>
      {DEALS.map(deal => (
        <div key={deal.title} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '8px 10px' }}>
          <span style={{ background: '#2fd06a', color: '#000', fontSize: 9, fontWeight: 800, borderRadius: 6, padding: '3px 6px', flexShrink: 0 }}>-{deal.pct}%</span>
          <span style={{ flex: 1, color: '#e2e8f0', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{deal.title}</span>
          <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, textDecoration: 'line-through', flexShrink: 0 }}>${deal.original}</span>
          <span style={{ color: '#2fd06a', fontSize: 13, fontWeight: 700, flexShrink: 0 }}>${deal.sale}</span>
        </div>
      ))}
    </div>
  )
}

/* ── c. Backlog badges ───────────────────────────────── */
const BADGE_CATS = [
  { emoji: '🎮', label: 'Action',   count: 9 },
  { emoji: '⚔️',  label: 'RPG',     count: 7 },
  { emoji: '🏆', label: 'Sports',   count: 4 },
  { emoji: '🧩', label: 'Strategy', count: 3 },
]

export function BadgesVisual() {
  const [counts, setCounts] = useState(
    REDUCE ? BADGE_CATS.map(() => 0) : BADGE_CATS.map(b => b.count)
  )

  useEffect(() => {
    if (REDUCE) return
    let step = 0
    const id = setInterval(() => {
      step++
      setCounts(prev => prev.map((c, i) => (i === step % 4 ? Math.max(0, c - 1) : c)))
      if (step >= 32) clearInterval(id)
    }, 280)
    return () => clearInterval(id)
  }, [])

  return (
    <div style={{ ...v.card, position: 'relative' }}>
      <Mascot src="/mascot_3_backlog.png" side="right" rotate={-12} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {BADGE_CATS.map((b, i) => (
          <div key={b.label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: '14px 10px', position: 'relative', textAlign: 'center' }}>
            <span style={{ fontSize: 26 }}>{b.emoji}</span>
            <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 10, marginTop: 5 }}>{b.label}</div>
            {counts[i] > 0 && (
              <div style={{ position: 'absolute', top: 7, right: 7, background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 700, minWidth: 16, height: 16, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
                {counts[i]}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── d. Push notification ────────────────────────────── */
export function NotificationVisual() {
  const [shown, setShown] = useState(REDUCE)

  useEffect(() => {
    if (REDUCE) return
    const t = setTimeout(() => setShown(true), 700)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{ ...v.card, position: 'relative', minHeight: 148, paddingBottom: '4.5rem' }}>
      <Mascot src="/mascot_4_launches.png" side="left" rotate={10} />
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 30, fontWeight: 200, color: '#f0f4f8', letterSpacing: '-0.02em', lineHeight: 1 }}>9:41</div>
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, marginTop: 2 }}>Friday, 15 October</div>
      </div>
      {shown && (
        <div
          className="notif-card"
          style={{
            background: 'rgba(25,28,45,0.96)',
            backdropFilter: 'blur(20px)',
            borderRadius: 14,
            padding: '10px 13px',
            border: '1px solid rgba(255,255,255,0.07)',
            animation: REDUCE ? 'none' : 'slide-down 0.4s cubic-bezier(0.22,1,0.36,1) forwards',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
            <div style={{ width: 20, height: 20, borderRadius: 6, background: '#2fd06a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, fontWeight: 700, color: '#000' }}>GB</div>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9 }}>GameBuddy · now</span>
          </div>
          <div style={{ color: '#f0f4f8', fontSize: 12, fontWeight: 600, marginBottom: 3 }}>🚀 Elden Ring DLC is live on Steam</div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10 }}>$24.99 · On your wishlist · Tap to view →</div>
        </div>
      )}
    </div>
  )
}

/* ── e. Memory chat ──────────────────────────────────── */
const MEMORY_MSGS = [
  { from: 'user', text: 'What games were on my wishlist last month?' },
  { from: 'bot',  text: 'You had 8 games. Top picks: Cyberpunk 2077, Disco Elysium & Hollow Knight 🧠' },
]

export function MemoryVisual() {
  return (
    <div style={{ ...v.card, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#2fd06a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7, fontWeight: 700, color: '#000' }}>GB</div>
        <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 10, fontWeight: 600 }}>GameBuddy Memory</span>
      </div>
      {MEMORY_MSGS.map((m, i) => {
        const isUser = m.from === 'user'
        return (
          <div key={i} style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
            <div style={{
              background:   isUser ? '#2fd06a' : '#1c2035',
              color:        isUser ? '#03200e' : '#e2e8f0',
              borderRadius: isUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
              padding: '8px 12px',
              fontSize: 11.5,
              lineHeight: 1.45,
              maxWidth: '88%',
            }}>
              {m.text}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ── Shared card style ───────────────────────────────── */
const v = {
  card: {
    background: 'rgba(8,8,18,0.75)',
    backdropFilter: 'blur(16px)',
    borderRadius: 18,
    padding: '1.25rem',
    border: '1px solid rgba(255,255,255,0.07)',
  },
}
