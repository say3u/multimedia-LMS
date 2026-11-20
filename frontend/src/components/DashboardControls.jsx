import { useState, useRef, useEffect } from 'react'

/* ── Icons ─────────────────────────────────────────────────────── */
const SearchIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
    <circle cx="6" cy="6" r="4.5" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5"/>
    <path d="M9.5 9.5L12 12" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)
const ChevronIcon = () => (
  <svg width="11" height="11" viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const CheckIcon = ({ size = 12, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 12 12" fill="none" aria-hidden="true">
    <path d="M2 6L5 9L10 3" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

/* ── Shared tokens ──────────────────────────────────────────────── */
const H      = 40
const R      = 8
const BORDER = '1px solid rgba(255,255,255,0.1)'
const BG     = 'rgba(12,12,12,0.55)'
const FONT   = { fontSize: '0.85rem', fontFamily: 'system-ui, sans-serif', color: '#e2e8f0' }

/* ── Click-outside hook ─────────────────────────────────────────── */
function useClickOutside(ref, fn) {
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) fn() }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [ref, fn])
}

/* ── CustomDropdown ─────────────────────────────────────────────── */
function CustomDropdown({ label, options, value, onChange, multi = false }) {
  const [open, setOpen]       = useState(false)
  const [focusIdx, setFocusIdx] = useState(0)
  const ref = useRef(null)

  useClickOutside(ref, () => setOpen(false))

  const isSelected = (v) => multi ? value.includes(v) : value === v

  const select = (v) => {
    if (multi) {
      onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v])
    } else {
      onChange(v)
      setOpen(false)
    }
  }

  const handleKeyDown = (e) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(true); setFocusIdx(0) }
      return
    }
    if (e.key === 'Escape')    { setOpen(false) }
    if (e.key === 'ArrowDown') { e.preventDefault(); setFocusIdx(i => Math.min(i + 1, options.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setFocusIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(options[focusIdx].value) }
  }

  const prefix = label.split(':')[0]
  const hasValue = multi ? value.length > 0 : value && value !== options[0]?.value

  const displayLabel = () => {
    if (multi) {
      if (!value.length) return label
      if (value.length === 1) return `${prefix}: ${options.find(o => o.value === value[0])?.label ?? value[0]}`
      return `${prefix}: ${value.length} selected`
    }
    const found = options.find(o => o.value === value)
    return found ? `${prefix}: ${found.label}` : label
  }

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        style={{ ...c.control, ...(open ? c.controlOpen : {}), ...(hasValue ? c.controlActive : {}) }}
        onClick={() => { setOpen(v => !v); setFocusIdx(0) }}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{displayLabel()}</span>
        <ChevronIcon />
      </button>

      {open && (
        <div style={c.menu} role="listbox" aria-multiselectable={multi}>
          {options.map((opt, i) => (
            <div
              key={opt.value}
              role="option"
              aria-selected={isSelected(opt.value)}
              tabIndex={-1}
              style={{
                ...c.menuItem,
                ...(i === focusIdx    ? c.menuItemFocus : {}),
                ...(isSelected(opt.value) ? c.menuItemSelected : {}),
              }}
              onClick={() => select(opt.value)}
              onMouseEnter={() => setFocusIdx(i)}
            >
              <span>{opt.label}</span>
              {isSelected(opt.value) && <CheckIcon size={11} color="#2fd06a" />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ── DashboardControls ──────────────────────────────────────────── */
export default function DashboardControls({
  search, onSearch,
  sort, onSort,
  platformOptions, selectedPlatforms, onPlatform,
  filterSale, onFilterSale,
  hasActiveFilters, onClear,
}) {
  const [focused, setFocused]   = useState(false)
  const [inputVal, setInputVal] = useState(search)
  const inputRef  = useRef(null)
  const debounceRef = useRef(null)

  useEffect(() => { setInputVal(search) }, [search])

  const handleChange = (val) => {
    setInputVal(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => onSearch(val), 150)
  }

  /* "/" global shortcut */
  useEffect(() => {
    const handler = (e) => {
      const tag = document.activeElement?.tagName
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && tag !== 'SELECT') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const SORT_OPTIONS = [
    { value: 'recently_added', label: 'Recently added' },
    { value: 'price_asc',      label: 'Price low → high' },
    { value: 'price_desc',     label: 'Price high → low' },
    { value: 'discount',       label: 'Biggest discount' },
    { value: 'name_asc',       label: 'Name A–Z' },
  ]

  return (
    <div style={c.row}>
      {/* Search */}
      <div style={{ ...c.searchWrap, ...(focused ? c.searchFocused : {}) }}>
        <span style={c.searchIcon} aria-hidden="true"><SearchIcon /></span>
        <input
          ref={inputRef}
          style={c.searchInput}
          placeholder="Search your watchlist"
          value={inputVal}
          onChange={e => handleChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={e => {
            if (e.key === 'Escape') { handleChange(''); inputRef.current?.blur() }
          }}
          aria-label="Search games"
        />
        {inputVal
          ? <button style={c.clearBtn} onClick={() => handleChange('')} aria-label="Clear search">×</button>
          : !focused && <span style={c.slashHint} aria-hidden="true">/</span>
        }
      </div>

      {/* Platform filter */}
      {platformOptions.length > 0 && (
        <CustomDropdown
          label="Platform: All"
          options={platformOptions}
          value={selectedPlatforms}
          onChange={onPlatform}
          multi
        />
      )}

      {/* On sale toggle */}
      <button
        style={{ ...c.control, ...(filterSale ? c.saleOn : {}) }}
        onClick={onFilterSale}
        tabIndex={0}
        onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onFilterSale())}
        aria-pressed={filterSale}
      >
        {filterSale && <CheckIcon size={11} color="#052e16" />}
        On sale
      </button>

      {/* Clear filters */}
      {hasActiveFilters && (
        <button style={c.clearFiltersBtn} onClick={onClear}>
          Clear filters
        </button>
      )}

      {/* Sort — pushed to far right */}
      <div style={{ marginLeft: 'auto' }}>
        <CustomDropdown
          label="Sort"
          options={SORT_OPTIONS}
          value={sort}
          onChange={onSort}
        />
      </div>
    </div>
  )
}

/* ── Styles ─────────────────────────────────────────────────────── */
const c = {
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    flexWrap: 'wrap',
  },

  /* search */
  searchWrap: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    maxWidth: 420,
    flex: '1 1 240px',
    height: H,
    background: BG,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: BORDER,
    borderRadius: R,
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    minWidth: 0,
  },
  searchFocused: {
    borderColor: '#2fd06a',
    boxShadow: '0 0 0 3px rgba(47,208,106,0.15)',
  },
  searchIcon: {
    position: 'absolute',
    left: 12,
    display: 'flex',
    alignItems: 'center',
    pointerEvents: 'none',
  },
  searchInput: {
    flex: 1,
    background: 'none',
    border: 'none',
    outline: 'none',
    paddingLeft: 34,
    paddingRight: 32,
    height: '100%',
    ...FONT,
    color: '#fff',
  },
  clearBtn: {
    position: 'absolute',
    right: 8,
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.4)',
    fontSize: '1.1rem',
    lineHeight: 1,
    cursor: 'pointer',
    padding: '2px 4px',
    display: 'flex',
    alignItems: 'center',
  },
  slashHint: {
    position: 'absolute',
    right: 10,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 4,
    padding: '0 5px',
    fontSize: '0.7rem',
    color: 'rgba(255,255,255,0.3)',
    lineHeight: '18px',
    pointerEvents: 'none',
    userSelect: 'none',
  },

  /* shared control (dropdown button + sale toggle) */
  control: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.35rem',
    height: H,
    padding: '0 12px',
    background: BG,
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    border: BORDER,
    borderRadius: R,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'border-color 0.15s ease, background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease',
    flexShrink: 0,
    ...FONT,
  },
  controlOpen: {
    borderColor: 'rgba(255,255,255,0.2)',
  },
  controlActive: {
    borderColor: 'rgba(47,208,106,0.45)',
    color: '#2fd06a',
  },
  saleOn: {
    background: '#2fd06a',
    borderColor: '#2fd06a',
    color: '#052e16',
    fontWeight: 700,
  },

  /* dropdown menu */
  menu: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    left: 0,
    minWidth: '100%',
    background: '#1c1c1c',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: R,
    padding: 4,
    zIndex: 200,
    boxShadow: '0 8px 24px rgba(0,0,0,0.55)',
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '7px 10px',
    borderRadius: 6,
    cursor: 'pointer',
    gap: '1.5rem',
    ...FONT,
    color: 'rgba(255,255,255,0.65)',
    transition: 'background 0.1s ease',
  },
  menuItemFocus: {
    background: 'rgba(255,255,255,0.07)',
    color: '#fff',
  },
  menuItemSelected: {
    color: '#2fd06a',
  },

  clearFiltersBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.38)',
    fontSize: '0.8rem',
    cursor: 'pointer',
    fontFamily: 'system-ui, sans-serif',
    padding: '0 2px',
    textDecoration: 'underline',
    textUnderlineOffset: 2,
    flexShrink: 0,
  },
}
