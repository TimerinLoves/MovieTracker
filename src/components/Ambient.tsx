import { useMemo } from 'react'
import { useTheme } from '../contexts/ThemeContext'

interface AmbientConfig {
  symbols: string[]
  className: string
  count: number
}

const THEME_AMBIENT: Record<string, AmbientConfig> = {
  moonlitMacarons: { symbols: ['✦', '·', '✧', '✧'], className: 'ambient-star', count: 22 },
  starrySweets: { symbols: ['✦', '★', '·', '✧'], className: 'ambient-star', count: 26 },
  snowflakeSorbet: { symbols: ['❄', '✦', '❅'], className: 'ambient-fall', count: 18 },
  peachyDreams: { symbols: ['✿', '❀', '☀'], className: 'ambient-fall-gentle', count: 16 },
  mintMacaron: { symbols: ['●', '•'], className: 'ambient-bounce', count: 14 },
  bubblegumGalaxy: { symbols: ['○', '●', '·'], className: 'ambient-drift', count: 18 },
  lavenderFields: { symbols: ['✿', '✾', '·'], className: 'ambient-drift', count: 16 },
  cottonCandyPortal: { symbols: ['✦', '·', '✧'], className: 'ambient-bounce', count: 20 },
  cloudCinema: { symbols: ['☁', '·', '✦'], className: 'ambient-drift', count: 14 },
}

interface Particle {
  left: number
  top: number
  size: number
  delay: number
  duration: number
  opacity: number
  symbol: string
  className: string
}

export default function Ambient() {
  const { themeId } = useTheme()

  const particles = useMemo<Particle[]>(() => {
    const config = THEME_AMBIENT[themeId] ?? THEME_AMBIENT.moonlitMacarons
    const seed = themeId
    let h = 0
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
    const rand = (n: number) => ((h = (h * 1664525 + 1013904223) >>> 0) / 4294967296) * n

    const list: Particle[] = []
    for (let i = 0; i < config.count; i++) {
      list.push({
        left: rand(100),
        top: rand(100),
        size: 8 + rand(16),
        delay: rand(8),
        duration: 6 + rand(12),
        opacity: 0.25 + rand(0.6),
        symbol: config.symbols[i % config.symbols.length],
        className: config.className,
      })
    }
    return list
  }, [themeId])

  return (
    <div className="ambient" aria-hidden="true">
      {particles.map((p, i) => (
        <span
          key={i}
          className={`ambient-particle ${p.className}`}
          style={{
            left: `${p.left}%`,
            top: `${p.top}%`,
            fontSize: `${p.size}px`,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
            opacity: p.opacity,
          }}
        >
          {p.symbol}
        </span>
      ))}
    </div>
  )
}