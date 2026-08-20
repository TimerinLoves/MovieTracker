interface RatingStarsProps {
  value: number
  max?: number
}

/** Read-only star display for an average rating value. */
export default function RatingStars({ value, max = 5 }: RatingStarsProps) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <span className="rating-stars" aria-label={`${value.toFixed(1)} of ${max}`}>
      <span className="rating-stars-track">☆☆☆☆☆</span>
      <span className="rating-stars-fill" style={{ width: `${pct}%` }}>
        ★★★★★
      </span>
    </span>
  )
}