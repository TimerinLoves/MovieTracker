import { useMemo, useState } from 'react'
import { RATING_CATEGORIES, averageCategoryScores } from '../constants'
import type { CategoryKey, CategoryScores, MediaItem, UserRating } from '../types'
import Modal from './Modal'
import StarSelect from './StarSelect'

interface RatingModalProps {
  item: MediaItem
  existing?: UserRating
  displayName: string
  onSubmit: (scores: CategoryScores) => void
  onClose: () => void
}

export default function RatingModal({ item, existing, displayName, onSubmit, onClose }: RatingModalProps) {
  const [scores, setScores] = useState<CategoryScores>(
    existing?.scores ?? {
      story: 0,
      acting: 0,
      visuals: 0,
      music: 0,
      rewatchability: 0,
      pacing: 0,
      emotionalImpact: 0,
    },
  )
  const [error, setError] = useState<string | null>(null)

  const setScore = (key: CategoryKey, value: number) => setScores((prev) => ({ ...prev, [key]: value }))

  const average = useMemo(() => {
    const values = Object.values(scores)
    return values.some((v) => v === 0) ? null : averageCategoryScores(scores)
  }, [scores])

  const allRated = Object.values(scores).every((v) => v > 0)

  const submit = () => {
    if (!allRated) {
      setError('Please score all 7 categories (1-5) before saving.')
      return
    }
    onSubmit(scores)
    onClose()
  }

  return (
    <Modal title={`Rate "${item.title}"`} onClose={onClose} maxWidth="560px">
      <p className="rating-as">Rating as <strong>{displayName}</strong>.</p>

      <div className="rating-form">
        {RATING_CATEGORIES.map((cat) => (
          <div key={cat.key} className="rating-row">
            <div className="rating-row-info">
              <span className="rating-row-label">{cat.label}</span>
              <span className="rating-row-desc">{cat.description}</span>
            </div>
            <StarSelect value={scores[cat.key]} onChange={(v) => setScore(cat.key, v)} label={cat.label} />
          </div>
        ))}
      </div>

      <div className="rating-footer">
        <div className="rating-average">
          {average !== null ? (
            <>
              <span className="score-badge score-badge-lg">
                <span className="score-badge-star">★</span> {average.toFixed(1)}
              </span>
              <span className="rating-outof">/ 5</span>
            </>
          ) : (
            <span className="rating-outof">- picks a score to preview your average</span>
          )}
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="rating-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-accent" onClick={submit}>
            {existing ? 'Update rating' : 'Save rating'}
          </button>
        </div>
      </div>
    </Modal>
  )
}