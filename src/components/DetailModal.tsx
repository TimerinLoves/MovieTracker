import { useEffect, useState } from 'react'
import { combineRatings } from '../constants'
import type { ListKey, MediaItem, MovieRating } from '../types'
import { LIST_KEYS } from '../types'
import { useData } from '../contexts/DataContext'
import { useAuth } from '../contexts/AuthContext'
import { getGenreMap, hasTmdbConfig, posterUrl } from '../utils/tmdb'
import Modal from './Modal'

const LIST_LABELS: Record<ListKey, string> = {
  wantToWatch: 'Want to Watch',
  currentlyWatching: 'Currently Watching',
  watched: 'Watched',
}

interface DetailModalProps {
  item: MediaItem
  onClose: () => void
  onRate: (item: MediaItem) => void
  onShowBreakdown: (item: MediaItem) => void
}

export default function DetailModal({ item, onClose, onRate, onShowBreakdown }: DetailModalProps) {
  const { lists, ratings, addToList } = useData()
  const { loggedIn, session } = useAuth()
  const [genres, setGenres] = useState<string[]>([])
  const [poster] = useState<string | null>(() => posterUrl(item.posterPath))

  useEffect(() => {
    let cancelled = false
    if (item.genreIds?.length) {
      getGenreMap().then((map) => {
        if (!cancelled) setGenres(item.genreIds!.map((id) => map.get(id)).filter(Boolean) as string[])
      }).catch(() => undefined)
    }
    return () => {
      cancelled = true
    }
  }, [item])

  const mediaKey = `${item.mediaType}-${item.id}`
  const inList = LIST_KEYS.find((k) => lists[k].some((m) => m.id === item.id && m.mediaType === item.mediaType))
  const movieRating: MovieRating | undefined = ratings[mediaKey]
  const combined = combineRatings(movieRating?.slot0?.average, movieRating?.slot1?.average)
  const myRating = session ? movieRating?.[`slot${session.slotId}` as 'slot0' | 'slot1'] : undefined

  return (
    <Modal title={`${item.title} (${item.year ?? '-'})`} onClose={onClose} maxWidth="620px">
      <div className="detail-layout">
        {poster ? (
          <img className="detail-poster" src={poster} alt={item.title} />
        ) : (
          <div className="detail-poster detail-poster-fallback">{item.title.slice(0, 1).toUpperCase()}</div>
        )}

        <div className="detail-info">
          <div className="detail-tags">
            <span className="chip chip-type">{item.mediaType === 'movie' ? 'Movie' : 'TV show'}</span>
            {item.year && <span className="chip">{item.year}</span>}
            {genres.map((g) => (
              <span key={g} className="chip">
                {g}
              </span>
            ))}
          </div>

          {item.voteAverage !== undefined && item.voteAverage > 0 && (
            <p className="detail-tmdb">
              TMDb community: <strong>{item.voteAverage?.toFixed(1)}</strong>
              {hasTmdbConfig() ? '' : ' (demo data)'}
            </p>
          )}

          <p className="detail-overview">{item.overview || 'No synopsis available.'}</p>

          {combined !== null && (
            <div className="detail-score">
              <span className="score-badge score-badge-lg">
                <span className="score-badge-star">★</span> {combined.toFixed(1)}
              </span>
              <span className="detail-score-note">our combined rating</span>
<button type="button" className="btn btn-ghost btn-sm" onClick={() => onShowBreakdown(item)}>
                View breakdown
              </button>
            </div>
          )}

          {inList && (
            <p className="detail-status">In list: <strong>{LIST_LABELS[inList]}</strong></p>
          )}

          {loggedIn && !inList && (
            <div className="detail-actions">
              <button className="btn btn-accent" onClick={() => addToList(item, 'wantToWatch')}>
                + Want to Watch
              </button>
              <button className="btn btn-accent" onClick={() => addToList(item, 'currentlyWatching')}>
                + Currently Watching
              </button>
            </div>
          )}

          {loggedIn && inList === 'watched' && (
            <div className="detail-actions">
              <button className="btn btn-accent" onClick={() => onRate(item)}>
                {myRating ? 'Update my rating' : '★ Rate this'}
              </button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  )
}