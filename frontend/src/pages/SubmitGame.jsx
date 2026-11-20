import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Nav from '../components/Nav.jsx'
import { api } from '../api.js'
import { C, ui } from '../ui.js'

// add your own game (obscure, delisted, not on a store we import) or a
// mod for an existing game. same form edits a game you added
// (/games/:id/edit). only the person who added a game can edit it.

const EMPTY = { title: '', developer: '', publisher: '', release_year: '', genre: '', synopsis: '', tags: '' }

export default function SubmitGame() {
  const { id }       = useParams()          // set when editing
  const [params]     = useSearchParams()
  const navigate     = useNavigate()
  const editing      = Boolean(id)
  const [form, setForm]         = useState(EMPTY)
  const [isMod, setIsMod]       = useState(Boolean(params.get('mod')))
  const [baseGame, setBaseGame] = useState(null)   // {game_id, title}
  const [baseQuery, setBaseQuery] = useState('')
  const [baseResults, setBaseResults] = useState([])
  const [duplicate, setDuplicate] = useState(null) // existing game with the same name
  const [error, setError]   = useState('')
  const [saving, setSaving] = useState(false)
  const [editingMod, setEditingMod] = useState(false) // keep the auto 'mod' tag when editing a mod

  // editing: fill the form in
  useEffect(() => {
    if (!editing) return
    api(`/api/games/${id}`).then((g) => {
      setEditingMod(Boolean(g.base_game_id))
      setForm({
        title: g.title || '', developer: g.developer || '', publisher: g.publisher || '',
        release_year: g.release_year || '', genre: '', synopsis: g.synopsis || '',
        tags: (g.tags || []).filter((t) => t !== 'mod').join(', '),
      })
    }).catch((e) => setError(e.message))
  }, [editing, id])

  // /games/new?mod=12 -> start as a mod of game 12
  useEffect(() => {
    const modOf = params.get('mod')
    if (!modOf || editing) return
    api(`/api/games/${modOf}`).then((g) => setBaseGame({ game_id: g.game_id, title: g.title })).catch(() => {})
  }, [params, editing])

  const searchBase = async (q) => {
    setBaseQuery(q)
    if (q.trim().length < 2) { setBaseResults([]); return }
    const d = await api(`/api/games?q=${encodeURIComponent(q)}&limit=8`).catch(() => ({ games: [] }))
    setBaseResults(d.games || [])
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const body = (force) => {
    const b = { title: form.title.trim() }
    for (const k of ['developer', 'publisher', 'genre', 'synopsis']) if (form[k].trim()) b[k] = form[k].trim()
    if (form.release_year) b.release_year = Number(form.release_year)
    b.tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean)
    if (editing && editingMod) b.tags.push('mod')
    if (!editing && isMod && baseGame) b.base_game_id = baseGame.game_id
    if (force) b.force = true
    return b
  }

  const submit = async (e, force = false) => {
    e?.preventDefault()
    setError(''); setDuplicate(null)
    if (!editing && isMod && !baseGame) { setError('Pick which game this is a mod for.'); return }
    setSaving(true)
    try {
      const d = editing
        ? await api(`/api/games/${id}`, { method: 'PATCH', body: body(false) })
        : await api('/api/games', { method: 'POST', body: body(force) })
      navigate(`/games/${d.game.game_id}`)
    } catch (err) {
      if (err.status === 409 && err.data?.game) setDuplicate(err.data.game)
      else setError(err.message)
      setSaving(false)
    }
  }

  return (
    <div style={ui.page}>
      <Nav />
      <div style={ui.narrow}>
        <div style={{ margin: '1rem 0 1.5rem' }}>
          <h1 style={ui.h1}>{editing ? 'Edit game' : 'Add a game'}</h1>
          {!editing && <p style={ui.sub}>For games we don't pull in from a store: mods, obscure or delisted games, your own game. After adding it you can log prices for it.</p>}
        </div>

        <form onSubmit={submit} style={{ ...ui.section, display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {!editing && (
            <div style={ui.row}>
              <button type="button" style={{ ...ui.pill, ...(!isMod ? ui.pillOn : {}) }} onClick={() => setIsMod(false)}>A game</button>
              <button type="button" style={{ ...ui.pill, ...(isMod ? ui.pillOn : {}) }} onClick={() => setIsMod(true)}>A mod for a game</button>
            </div>
          )}

          {!editing && isMod && (
            <Field label="Mod for">
              {baseGame ? (
                <div style={{ ...ui.row, ...ui.input }}>
                  <span style={{ color: C.text, flex: 1 }}>{baseGame.title}</span>
                  <button type="button" style={{ ...s.x }} onClick={() => setBaseGame(null)} aria-label="Change game">✕</button>
                </div>
              ) : (
                <>
                  <input style={ui.input} placeholder="Search for the game…" value={baseQuery} onChange={(e) => searchBase(e.target.value)} />
                  {baseResults.length > 0 && (
                    <div style={s.results}>
                      {baseResults.map((g) => (
                        <button type="button" key={g.game_id} style={s.resultItem}
                          onClick={() => { setBaseGame({ game_id: g.game_id, title: g.title }); setBaseResults([]); setBaseQuery('') }}>
                          {g.title}{g.release_year ? ` (${g.release_year})` : ''}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </Field>
          )}

          <Field label="Title *"><input style={ui.input} value={form.title} onChange={set('title')} maxLength={255} required /></Field>
          <div style={{ ...ui.row, flexWrap: 'nowrap' }}>
            <Field label="Developer" grow><input style={{ ...ui.input, width: '100%' }} value={form.developer} onChange={set('developer')} maxLength={255} /></Field>
            <Field label="Year"><input style={{ ...ui.input, width: 100 }} type="number" min="1950" max="2100" value={form.release_year} onChange={set('release_year')} /></Field>
          </div>
          <div style={{ ...ui.row, flexWrap: 'nowrap' }}>
            <Field label="Publisher" grow><input style={{ ...ui.input, width: '100%' }} value={form.publisher} onChange={set('publisher')} maxLength={255} /></Field>
            <Field label="Genre" grow><input style={{ ...ui.input, width: '100%' }} value={form.genre} onChange={set('genre')} maxLength={100} placeholder={editing ? 'unchanged' : ''} /></Field>
          </div>
          <Field label="Tags (comma separated)"><input style={ui.input} value={form.tags} onChange={set('tags')} placeholder="e.g. obscure, vr, co-op" /></Field>
          <Field label="Description"><textarea style={{ ...ui.input, minHeight: 90, resize: 'vertical' }} value={form.synopsis} onChange={set('synopsis')} maxLength={5000} /></Field>

          {duplicate && (
            <div style={s.warn}>
              We already have <Link to={`/games/${duplicate.game_id}`} style={ui.link}>{duplicate.title}</Link>. Is yours a different game with the same name?
              <div style={{ ...ui.row, marginTop: '0.5rem' }}>
                <button type="button" style={ui.button} onClick={(e) => submit(e, true)}>Yes, add it anyway</button>
                <Link to={`/games/${duplicate.game_id}`} style={{ ...ui.ghost, textDecoration: 'none' }}>No, go to that game</Link>
              </div>
            </div>
          )}
          {error && <p style={ui.error}>{error}</p>}

          <div style={{ ...ui.row, justifyContent: 'flex-end' }}>
            <button type="button" style={ui.ghost} onClick={() => navigate(-1)}>Cancel</button>
            <button type="submit" style={{ ...ui.button, opacity: saving ? 0.5 : 1 }} disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add game'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, children, grow }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', flex: grow ? 1 : undefined, minWidth: 0 }}>
      <span style={ui.label}>{label}</span>
      {children}
    </label>
  )
}

const s = {
  results:    { display: 'flex', flexDirection: 'column', background: C.field, border: `1px solid ${C.border}`, borderRadius: 8, overflow: 'hidden' },
  resultItem: { background: 'none', border: 'none', borderBottom: `1px solid ${C.border}`, color: C.text, textAlign: 'left', padding: '0.55rem 0.85rem', cursor: 'pointer', fontSize: '0.875rem', fontFamily: 'system-ui, sans-serif' },
  x:          { background: 'none', border: 'none', color: C.muted, cursor: 'pointer' },
  warn:       { background: '#f59e0b14', border: '1px solid #f59e0b55', borderRadius: 8, padding: '0.75rem 1rem', color: C.text, fontSize: '0.875rem' },
}
