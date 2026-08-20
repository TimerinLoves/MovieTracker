import { useState } from 'react'

interface StarSelectProps {
  value: number
  onChange: (value: number) => void
  label?: string
  disabled?: boolean
}

export default function StarSelect({ value, onChange, label, disabled }: StarSelectProps) {
  const [hover, setHover] = useState<number>(0)
  const shown = hover || value

  return (
    <div className="star-select" role="radiogroup" aria-label={label}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          className={`star-dot${n <= shown ? ' filled' : ''}`}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          aria-label={`${label ?? 'Score'} ${n} of 5`}
        >
          {n <= shown ? '★' : '☆'}
        </button>
      ))}
    </div>
  )
}