import { RATING_CATEGORIES, combineRatings } from '../constants'
import type { MovieRating } from '../types'
import Modal from './Modal'
import RatingStars from './RatingStars'

interface ScoreBreakdownProps {
  mediaKey: string
  title: string
  rating: MovieRating
  labelA: string
  labelB: string
  onClose: () => void
}

export default function ScoreBreakdown({ title, rating, labelA, labelB, onClose }: ScoreBreakdownProps) {
  const a = rating.slot0
  const b = rating.slot1
  const combined = combineRatings(a?.average, b?.average)

  return (
    <Modal title={`Score breakdown - ${title}`} onClose={onClose} maxWidth="640px">
      <table className="breakdown-table">
        <thead>
          <tr>
            <th>Category</th>
            {a && <th>{a.ratedByName ?? labelA}</th>}
            {b && <th>{b.ratedByName ?? labelB}</th>}
          </tr>
        </thead>
        <tbody>
          {RATING_CATEGORIES.map((cat) => (
            <tr key={cat.key}>
              <td>{cat.label}</td>
              {a ? <td>{a.scores[cat.key]}</td> : <td className="breakdown-empty">-</td>}
              {b ? <td>{b.scores[cat.key]}</td> : <td className="breakdown-empty">-</td>}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Average</td>
            {a ? <td>{a.average.toFixed(1)}</td> : <td className="breakdown-empty">-</td>}
            {b ? <td>{b.average.toFixed(1)}</td> : <td className="breakdown-empty">-</td>}
          </tr>
        </tfoot>
      </table>

      {combined !== null && (
        <div className="combined-box">
          <span className="combined-label">Combined score</span>
          <span className="combined-value">
            <span className="score-badge score-badge-lg">
              <span className="score-badge-star">★</span> {combined.toFixed(1)}
            </span>
            <RatingStars value={combined} />
          </span>
        </div>
      )}
    </Modal>
  )
}