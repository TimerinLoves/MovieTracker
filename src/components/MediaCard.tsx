import type { MediaItem, MovieRating } from '../types'
import { combineRatings } from '../constants'
import { posterUrl } from '../utils/tmdb'

interface MediaCardProps {
  item: MediaItem
  rating?: MovieRating
  removable?: boolean
  compact?: boolean
  onRemove?: (() => void) | null
  onClick?: () => void
}

export default function MediaCard({ item, rating, removable, compact, onRemove, onClick }: MediaCardProps) {
  const poster = posterUrl(item.posterPath)
  const combined = combineRatings(rating?.slot0?.average, rating?.slot1?.average)

  return (
    <div
      className={`media-card${compact ? ' media-card--compact' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      {poster ? (
        <div className="media-poster">
          <img src={poster} alt={item.title} loading="lazy" />
        </div>
      ) : (
        <div className="media-poster media-poster-fallback">
          <span>{item.title.slice(0, 1).toUpperCase()}</span>
        </div>
      )}

      <div className="media-body">
        <div className="media-title" title={item.title}>
          {item.title}
        </div>
        <div className="media-meta">
          <span className="chip chip-type">{item.mediaType === 'movie' ? 'Movie' : 'Show'}</span>
          {item.year && <span className="media-year">{item.year}</span>}
        </div>

        <div className="media-badges">
          {combined !== null && (
            <span className="score-badge" title="Combined rating (both users)">
              <span className="score-badge-star">★</span> {combined.toFixed(1)}
            </span>
          )}
          {item.voteAverage !== undefined && item.voteAverage > 0 && (
            <span className="tmdb-score" title="TMDb community score">
              {item.voteAverage.toFixed(1)}
            </span>
          )}
        </div>
      </div>

      {removable && onRemove && (
        <button
          className="media-remove"
          type="button"
          aria-label={`Remove ${item.title}`}
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
        >
          ✕
        </button>
      )}
    </div>
  )
}