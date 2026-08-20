import type { ThemeDefinition } from '../types'

export const THEMES: ThemeDefinition[] = [
  {
    id: 'moonlitMacarons',
    name: 'Moonlit Macarons',
    preview: 'linear-gradient(160deg, #2d1b4a 0%, #4a3660 55%, #8b5e83 100%)',
  },
  {
    id: 'snowflakeSorbet',
    name: 'Snowflake Sorbet',
    preview: 'linear-gradient(160deg, #cfeef7 0%, #b0e0e6 45%, #ffd0e3 100%)',
  },
  {
    id: 'peachyDreams',
    name: 'Peachy Dreams',
    preview: 'linear-gradient(160deg, #ffdab9 0%, #ffb58a 50%, #fff3b0 100%)',
  },
  {
    id: 'starrySweets',
    name: 'Starry Sweets',
    preview: 'linear-gradient(160deg, #1b1050 0%, #2d1b69 55%, #6b2d5c 100%)',
  },
  {
    id: 'mintMacaron',
    name: 'Mint Macaron',
    preview: 'linear-gradient(160deg, #c9f5c9 0%, #98fb98 50%, #ffd6e0 100%)',
  },
  {
    id: 'bubblegumGalaxy',
    name: 'Bubblegum Galaxy',
    preview: 'linear-gradient(160deg, #ffd9e6 0%, #ffb7c5 50%, #e6c8ee 100%)',
  },
  {
    id: 'lavenderFields',
    name: 'Lavender Fields',
    preview: 'linear-gradient(160deg, #ece8f7 0%, #d8bfd8 55%, #fff4dd 100%)',
  },
  {
    id: 'cottonCandyPortal',
    name: 'Cotton Candy Portal',
    preview: 'linear-gradient(160deg, #ffc0e0 0%, #ff97c8 50%, #7cabff 100%)',
  },
  {
    id: 'cloudCinema',
    name: 'Cloud Cinema',
    preview: 'linear-gradient(160deg, #ffe9f0 0%, #ffb6c1 45%, #87ceeb 100%)',
  },
]

export const DEFAULT_THEME_ID = 'moonlitMacarons'

export function getThemeById(id: string): ThemeDefinition {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}