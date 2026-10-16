const steam = (id) =>
  `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/library_600x900.jpg`

const GAMES = [
  { title: 'Elden Ring',                img: steam(1245620) },
  { title: "Baldur's Gate 3",           img: steam(1086940) },
  { title: 'Hades II',                  img: steam(1145350) },
  { title: 'Cyberpunk 2077',            img: steam(1091500) },
  { title: 'Hollow Knight: Silksong',   img: steam(1030300) },
  { title: 'The Witcher 3: Wild Hunt',  img: steam(292030)  },
  { title: 'Red Dead Redemption 2',     img: steam(1174180) },
  { title: "Marvel's Spider-Man 2",     img: steam(2651280) },
  { title: 'God of War',                img: steam(1593500) },
  { title: 'Starfield',                 img: steam(1716740) },
  { title: 'Disco Elysium',             img: steam(632470)  },
  { title: 'Dark Souls III',            img: steam(374320)  },
  { title: 'Sekiro: Shadows Die Twice', img: steam(814380)  },
  { title: 'Black Myth: Wukong',        img: steam(2358720) },
  { title: 'Ghost of Tsushima',         img: steam(2215430) },
  { title: 'Clair Obscur: Expedition 33', img: steam(1903340) },
  { title: 'Monster Hunter Wilds',      img: steam(2246340) },
  { title: 'Resident Evil 4',           img: steam(2050650) },
  { title: 'Hollow Knight',             img: steam(367520)  },
  { title: 'Stardew Valley',            img: steam(413150)  },
]

const REDUCE =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const tile = (arr) => [...arr, ...arr, ...arr, ...arr]
const ROW1 = tile(GAMES.slice(0, 5))
const ROW2 = tile(GAMES.slice(5, 10))
const ROW3 = tile(GAMES.slice(10, 15))

const STICKER = [
  'drop-shadow(-3px 0 0 #fff)',
  'drop-shadow(3px 0 0 #fff)',
  'drop-shadow(0 -3px 0 #fff)',
  'drop-shadow(0 3px 0 #fff)',
  'drop-shadow(-2px -2px 0 #fff)',
  'drop-shadow(2px -2px 0 #fff)',
  'drop-shadow(-2px 2px 0 #fff)',
  'drop-shadow(2px 2px 0 #fff)',
  'drop-shadow(0 10px 28px rgba(0,0,0,0.6))',
].join(' ')

export default function LaptopMockup() {
  return (
    <div style={l.wrap}>
      <div style={l.lid}>
        <div style={l.screen}>
          <div style={l.viewport}>
            <PosterRow games={ROW1} dir="left"  speed={28} />
            <PosterRow games={ROW2} dir="right" speed={22} />
            <PosterRow games={ROW3} dir="left"  speed={32} />
          </div>
        </div>
      </div>
      <img
        src="/mascot.png"
        alt=""
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: '-20px',
          right: '-80px',
          width: '280px',
          transform: 'rotate(-10deg)',
          filter: STICKER,
          zIndex: 10,
          pointerEvents: 'none',
        }}
      />
    </div>
  )
}

function PosterRow({ games, dir, speed }) {
  return (
    <div style={{ overflow: 'hidden' }}>
      <div
        className="marquee-track"
        style={{
          display: 'flex',
          gap: 16,
          width: 'max-content',
          animation: REDUCE ? 'none' : `${dir === 'left' ? 'marquee-left' : 'marquee-right'} ${speed}s linear infinite`,
        }}
      >
        {games.map((g, i) => <Poster key={i} game={g} />)}
      </div>
    </div>
  )
}

function Poster({ game }) {
  return (
    <div style={{ position: 'relative', width: 110, height: 155, borderRadius: 10, overflow: 'hidden', flexShrink: 0 }}>
      <img
        src={game.img}
        alt={game.title}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.82) 100%)' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 6px 6px' }}>
        <div style={{ color: '#fff', fontSize: 8.5, fontWeight: 700, lineHeight: 1.2, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>{game.title}</div>
      </div>
    </div>
  )
}

const l = {
  wrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative', zIndex: 1, flexShrink: 0 },
  lid: {
    width: 680,
    background: '#0d0d0d',
    borderRadius: '12px 12px 4px 4px',
    border: 'none',
    boxShadow: '0 32px 80px rgba(0,0,0,0.65), inset 0 0 0 1px rgba(255,255,255,0.04)',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  screen:  { background: '#060606', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  viewport: {
    padding: '16px 0',
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
    overflow: 'hidden',
    WebkitMaskImage: 'linear-gradient(180deg, transparent 0%, black 12%, black 88%, transparent 100%), linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%)',
    WebkitMaskComposite: 'destination-in',
    maskImage: 'linear-gradient(180deg, transparent 0%, black 12%, black 88%, transparent 100%), linear-gradient(90deg, transparent 0%, black 8%, black 92%, transparent 100%)',
    maskComposite: 'intersect',
  },
}
