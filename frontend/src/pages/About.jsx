import { useState } from 'react'
import Nav    from '../components/Nav.jsx'
import Footer from '../components/Footer.jsx'
import WaveCanvas from '../components/WaveCanvas.jsx'

const MISSION = `GameBuddy was born out of a simple frustration: keeping track of games across dozens of
platforms was a mess. We aim to give players better control over their wishlists so they can find the right games at the right price without being overwhelmed by unnecessary alerts.`

const TEAM = [
  {
    id: 1,
    name: 'David Nguyen',
    role: 'Team Lead',
    photo: '/team/member1.jpg',
    bio: `Every price tracker pings you the same for every game on your list. GameBuddy fixes that. I built the database so each wishlist item has its own notification setting, like “alert me now” or “just track it.”<br/><br/> We’re starting local, single-user, but the schema already supports accounts and multiple users, so adding that later won’t mean rebuilding anything. It’s been a solid way to actually apply stuff from class, like transactions and schema design, instead of just reading about it.`,
  },
  {
    id: 2,
    name: 'Eugene Vinnichenko',
    role: 'Backend & Database',
    photo: '/team/member2.jpg',
    bio: `When you hear about a new game that you want to play "sometime later', the reaction is simple: find its store page, add to wishlist, and forget about it as it's being buried in the price alert among dozens of other similar games. Worse, when I do want to buy a game I have to check if I don't already have it on one of the official storefronts already.<br/><br/>The idea behind GameBuddy is to change that, decreasing price alerts to a more manageable number and unifying all of your gaming library into one simple app.`,
  },
  {
    id: 3,
    name: 'Elmer Mendez',
    role: 'Backend & Frontend',
    photo: '/team/member3.jpg',
    bio: `Finding your next favorite game should be exciting, not tedious. Throughout my college years, I often overheard fellow gamers complain about the frustration of scrolling and clicking through multiple pages just to find a game they're into. When I learned about the founder’s original vision for GameBuddy to fix this issue, I jumped at the opportunity to help bring it to life.<br/><br/>With GameBuddy, gamers can discover games more quickly and find great deals without the hassle of searching multiple websites for discounts and promo codes. GameBuddy also supports networking, where gamers can share their favorite games and grow their community all across the United States. `,
  },
  {
    id: 4,
    name: 'Brandon Tse',
    role: 'Backend & Testing',
    photo: '/team/member4.jpg',
    bio: `GameBuddy is a multi-user video game wishlist and price-tracking application designed to make deal alerts more manageable.<br/><br/>Unlike other price trackers that treat every wishlist item equally, GameBuddy allows users to put their wishlisted games into custom notification categories based on how interested they are in each of them. It will hopefully be able to track prices across major and niche platforms, store historical pricing information, and notify users when a game reaches their target price. This combination of flexible organization, personalized alerts, and multi platform support helps to make Gamebuddy stand out. `,
  },
  {
    id: 5,
    name: 'Harish Raaj',
    role: 'Frontend',
    photo: '/team/member5.jpg',
    bio: `So you know how price trackers ping you for literally every game on your wishlist, even the ones you barely care about? That’s what GameBuddy fixes. You sort your games into your own alert groups. It tracks prices across big and niche stores, keeps a price history, and lets you know when a game hits your target price.<br/><br/>As the frontend lead, we’re going for something that actually feels nice to use: clean, easy to move around, and not cluttered like most deal sites.`,
  },
]

function MemberCard({ member }) {
  const [imgOk, setImgOk] = useState(true)
  const initials = member.name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()

  return (
    <div style={s.card}>
      <div style={s.photoWrap}>
        {imgOk ? (
          <img
            src={member.photo}
            alt={member.name}
            style={s.photo}
            onError={() => setImgOk(false)}
          />
        ) : (
          <div style={s.avatar}>{initials}</div>
        )}
      </div>
      <div style={s.cardBody}>
        <span style={s.memberName}>{member.name}</span>
        <span style={s.memberRole}>{member.role}</span>
        <p style={s.memberBio} dangerouslySetInnerHTML={{ __html: member.bio }} />
      </div>
    </div>
  )
}

export default function Blog() {
  return (
    <main style={s.page}>
      {/* ── Hero ── */}
      <section style={s.hero}>
        <WaveCanvas wrapperStyle={s.waveLayer} />
        <div style={s.vignette} />
        <div style={s.navWrapper}><Nav /></div>

        <div style={s.heroInner}>
          <div style={s.pill}>Our Story</div>
          <h1 style={s.heroTitle}>Your wishlist, <br />but smarter</h1>
          <p style={s.heroSub}>
            We are a small team with one goal: make it easier to play the games you love.
          </p>
        </div>
      </section>

      {/* ── Mission ── */}
      <section style={s.missionSection}>
        <div style={s.missionInner}>
          <h2 style={s.sectionLabel}>Our Mission</h2>
          <p style={s.missionText}>{MISSION}</p>
        </div>
      </section>

      {/* ── Team ── */}
      <section style={s.teamSection}>
        <div style={s.teamInner}>
          <h2 style={s.sectionLabel}>Meet the Team</h2>
          <p style={s.teamSub}>The people who made GameBuddy happen.</p>
          <div style={s.grid}>
            {TEAM.map((m) => <MemberCard key={m.id} member={m} />)}
          </div>
        </div>
      </section>

      <Footer />
    </main>
  )
}

const s = {
  page: {
    background: '#000',
    fontFamily: 'system-ui, sans-serif',
    color: '#fff',
    minHeight: '100vh',
  },

  /* hero */
  hero: {
    position: 'relative',
    width: '100%',
    minHeight: '55vh',
    background: '#000',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  navWrapper: { position: 'relative', zIndex: 10 },
  waveLayer: {
    pointerEvents: 'none',
    position: 'absolute',
    inset: '-6rem 0 0 0',
    bottom: 0,
    zIndex: 1,
    opacity: 0.3,
    mixBlendMode: 'screen',
    WebkitMaskImage: 'linear-gradient(180deg, black 0%, black 62%, transparent 98%)',
    maskImage: 'linear-gradient(180deg, black 0%, black 62%, transparent 98%)',
  },
  vignette: {
    pointerEvents: 'none',
    position: 'absolute',
    inset: 0,
    zIndex: 2,
    background: 'radial-gradient(ellipse at 50% 30%, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 70%, rgba(0,0,0,0.9) 100%)',
  },
  heroInner: {
    position: 'relative',
    zIndex: 5,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    padding: '5rem 2rem 6rem',
    gap: '1.25rem',
  },
  pill: {
    display: 'inline-block',
    background: 'rgba(47,208,106,0.12)',
    color: '#2fd06a',
    fontSize: '0.8rem',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    padding: '0.35rem 0.85rem',
    borderRadius: 99,
    border: '1px solid rgba(47,208,106,0.25)',
  },
  heroTitle: {
    fontSize: 'clamp(2.4rem, 5vw, 4rem)',
    fontWeight: 800,
    lineHeight: 1.1,
    margin: 0,
    letterSpacing: '-0.02em',
  },
  heroSub: {
    fontSize: '1.15rem',
    color: 'rgba(255,255,255,0.6)',
    maxWidth: 480,
    margin: 0,
    lineHeight: 1.6,
  },

  /* mission */
  missionSection: {
    borderTop: '1px solid rgba(255,255,255,0.06)',
    padding: '6rem 2rem',
  },
  missionInner: {
    maxWidth: 760,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1.5rem',
  },
  sectionLabel: {
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: '#2fd06a',
    margin: 0,
  },
  missionText: {
    fontSize: '1.25rem',
    lineHeight: 1.8,
    color: 'rgba(255,255,255,0.82)',
    margin: 0,
    fontWeight: 400,
  },

  /* team */
  teamSection: {
    borderTop: '1px solid rgba(255,255,255,0.06)',
    padding: '6rem 2rem 8rem',
  },
  teamInner: {
    maxWidth: 1100,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  teamSub: {
    fontSize: '1rem',
    color: 'rgba(255,255,255,0.5)',
    margin: '0 0 2.5rem',
  },
  grid: {
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: '1.5rem',
  },

  /* card */
  card: {
    background: '#0d0d0d',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 16,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    transition: 'border-color 0.2s',
    flex: '0 0 calc(33.333% - 1rem)',
    minWidth: 280,
  },
  photoWrap: {
    width: '100%',
    height: 320,
    overflow: 'hidden',
    background: '#111',
  },
  photo: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'top',
    display: 'block',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: '50%',
    background: 'rgba(47,208,106,0.18)',
    border: '2px solid rgba(47,208,106,0.3)',
    color: '#2fd06a',
    fontSize: '1.5rem',
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    padding: '1.25rem 1.5rem 1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    flex: 1,
  },
  memberName: {
    fontSize: '1.3rem',
    fontWeight: 800,
    color: '#fff',
    letterSpacing: '-0.01em',
  },
  memberRole: {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'rgba(47,208,106,0.5)',
    letterSpacing: '0.03em',
    marginBottom: '0.5rem',
  },
  memberBio: {
    fontSize: '0.875rem',
    lineHeight: 1.65,
    color: 'rgba(255,255,255,0.6)',
    margin: 0,
  },
}
