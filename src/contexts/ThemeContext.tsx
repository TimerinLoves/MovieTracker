import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { DEFAULT_THEME_ID, getThemeById, THEMES } from '../themes/themes'
import type { ThemeDefinition } from '../types'
import { loadTheme, saveTheme } from '../utils/storage'

interface ThemeContextValue {
  themeId: string
  theme: ThemeDefinition
  themes: ThemeDefinition[]
  setTheme: (id: string) => void
  cycleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<string>(() => loadTheme() ?? DEFAULT_THEME_ID)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', themeId)
    saveTheme(themeId)
  }, [themeId])

  const setTheme = useCallback((id: string) => {
    setThemeId(id)
  }, [])

  const cycleTheme = useCallback(() => {
    setThemeId((prev) => {
      const idx = THEMES.findIndex((t) => t.id === prev)
      return THEMES[(idx + 1) % THEMES.length].id
    })
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({
      themeId,
      theme: getThemeById(themeId),
      themes: THEMES,
      setTheme,
      cycleTheme,
    }),
    [themeId, setTheme, cycleTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}