import { useEffect, useRef, useState } from 'react'
import { useTheme } from '../contexts/ThemeContext'
import { getThemeById } from '../themes/themes'

export default function ThemeSwitcher() {
  const { themeId, themes, setTheme, cycleTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const current = getThemeById(themeId)

  return (
    <div className="theme-switcher" ref={ref}>
      <button
        type="button"
        className="btn btn-ghost theme-quick"
        onClick={() => setOpen((v) => !v)}
        title="Switch theme"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="theme-swatch" style={{ background: current.preview }} />
        <span className="theme-quick-name">{current.name}</span>
        <span className="theme-cycle" onClick={(e) => { e.stopPropagation(); cycleTheme() }} title="Next theme">
          ↻
        </span>
      </button>

      {open && (
        <div className="theme-menu" role="listbox">
          {themes.map((t) => (
            <button
              key={t.id}
              type="button"
              role="option"
              aria-selected={t.id === themeId}
              className={`theme-option${t.id === themeId ? ' active' : ''}`}
              onClick={() => {
                setTheme(t.id)
                setOpen(false)
              }}
            >
              <span className="theme-swatch" style={{ background: t.preview }} />
              {t.name}
              {t.id === themeId && <span className="theme-check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}