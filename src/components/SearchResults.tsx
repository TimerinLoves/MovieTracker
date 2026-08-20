import { useEffect, useState } from 'react'
import type { MediaItem } from '../types'
import { hasTmdbConfig, searchAll } from '../utils/tmdb'
import { demoSearch } from '../utils/demo'
import MediaCard from './MediaCard'

interface SearchResultsProps {
  query: string
  onOpenDetail: (item: MediaItem) => void
}

export default function SearchResults({ query, onOpenDetail }: SearchResultsProps) {
  const [results, setResults] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const demoMode = !hasTmdbConfig()

  useEffect(() => {
    let cancelled = false
    const q = query.trim()
    if (!q) {
      setResults([])
      return
    }

    const run = async () => {
      setError(null)
      setLoading(true)
      try {
        const found = demoMode ? demoSearch(q) : await searchAll(q)
        if (!cancelled) setResults(found)
      } catch {
        if (!cancelled) {
          setResults([])
          setError('Search failed. TMDb may be unavailable right now.')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    const timer = window.setTimeout(run, 350)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [query, demoMode])

  if (error) {
    return <div className="empty-state">{error}</div>
  }

  if (demoMode) {
    return (
      <div className="results-block">
        <p className="search-note">
          Demo mode - no TMDb API key configured. Add one in <code>.env</code> (see README) for real search results.
        </p>
        {results.length > 0 && (
          <div className="results-grid">
            {results.map((item) => (
              <MediaCard key={`${item.mediaType}-${item.id}`} item={item} onClick={() => onOpenDetail(item)} />
            ))}
          </div>
        )}
      </div>
    )
  }

  if (loading) {
    return <div className="empty-state searching">Searching...</div>
  }

  if (results.length === 0) {
    return <div className="empty-state">No matches for "{query}".</div>
  }

  return (
    <div className="results-block">
      <p className="search-note">
        {results.length} result{results.length === 1 ? '' : 's'} for "{query}"
      </p>
      <div className="results-grid">
        {results.map((item) => (
          <MediaCard key={`${item.mediaType}-${item.id}`} item={item} onClick={() => onOpenDetail(item)} />
        ))}
      </div>
    </div>
  )
}