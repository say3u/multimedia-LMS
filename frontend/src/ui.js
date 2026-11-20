// shared styles + formatting for the phase 2 pages (game page, browse,
// add game, feed, profile). same colors/fonts as harish's dashboard so
// everything looks like one app.

export const C = {
  bg:      '#080808',
  card:    '#111',
  field:   '#1e1e1e',
  border:  '#2a2a2a',
  text:    '#e2e8f0',
  muted:   '#94a3b8',
  faint:   'rgba(255,255,255,0.4)',
  green:   '#2fd06a',
  greenBg: '#2fd06a18',
  red:     '#f87171',
}

const font = 'system-ui, sans-serif'

export const ui = {
  page:      { minHeight: '100vh', background: C.bg, fontFamily: font },
  body:      { padding: '1.25rem 4rem 3rem', maxWidth: 1100, margin: '0 auto' },
  narrow:    { padding: '1.25rem 2rem 3rem', maxWidth: 720, margin: '0 auto' },
  h1:        { fontSize: 28, fontWeight: 700, color: '#fff', margin: 0, lineHeight: 1.2 },
  h2:        { fontSize: 17, fontWeight: 700, color: C.text, margin: '0 0 0.75rem' },
  sub:       { fontSize: 14, color: 'rgba(255,255,255,0.55)', margin: '0.3rem 0 0' },
  section:   { background: C.card, border: `1px solid ${C.border}`, borderRadius: 10, padding: '1.25rem 1.5rem' },
  label:     { color: C.muted, fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' },
  input:     { background: C.field, border: `1px solid ${C.border}`, borderRadius: 8, padding: '0.55rem 0.85rem', color: C.text, fontSize: '0.9rem', fontFamily: font, outline: 'none', boxSizing: 'border-box' },
  button:    { background: C.green, border: 'none', borderRadius: 8, padding: '0.5rem 1.1rem', color: '#080808', fontSize: '0.875rem', fontFamily: font, fontWeight: 700, cursor: 'pointer' },
  ghost:     { background: 'none', border: `1px solid ${C.border}`, borderRadius: 8, padding: '0.5rem 1rem', color: C.muted, fontSize: '0.875rem', fontFamily: font, cursor: 'pointer' },
  pill:      { background: C.field, border: `1px solid ${C.border}`, borderRadius: 20, padding: '0.3rem 0.85rem', color: C.muted, fontSize: '0.8rem', fontFamily: font, cursor: 'pointer' },
  pillOn:    { background: C.greenBg, border: `1px solid ${C.green}`, color: C.green },
  tag:       { display: 'inline-block', background: C.greenBg, color: C.green, fontSize: '0.7rem', fontWeight: 700, padding: '0.15rem 0.55rem', borderRadius: 20, textDecoration: 'none' },
  link:      { color: C.green, textDecoration: 'none', fontWeight: 600 },
  error:     { color: C.red, fontSize: '0.85rem', margin: 0 },
  muted:     { color: C.muted, fontSize: '0.85rem', margin: 0 },
  row:       { display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' },
}

export function money(n, currency = 'USD') {
  if (n === null || n === undefined) return '—'
  return (currency === 'USD' ? '$' : `${currency} `) + Number(n).toFixed(2)
}

export function timeAgo(iso) {
  if (!iso) return ''
  const secs = (Date.now() - new Date(iso).getTime()) / 1000
  if (secs < 60) return 'just now'
  const steps = [[60, 'minute'], [3600, 'hour'], [86400, 'day'], [604800, 'week'], [2629800, 'month'], [31557600, 'year']]
  let unit = steps[0]
  for (const step of steps) if (secs >= step[0]) unit = step
  const n = Math.floor(secs / unit[0])
  return `${n} ${unit[1]}${n === 1 ? '' : 's'} ago`
}

// activity_events.event_type -> what the feed says
export const EVENT_TEXT = {
  wishlisted: 'added to their wishlist',
  bought:     'bought',
  started:    'started playing',
  finished:   'finished',
  reviewed:   'reviewed',
}

export const STORE_TYPE_LABEL = { pc: 'PC', console: 'Console', vr: 'VR', mobile: 'Mobile', mods: 'Mods' }
