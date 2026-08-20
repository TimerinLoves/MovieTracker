import type { MediaItem, MediaType } from '../types'
import { getYear } from '../constants'

const BASE = 'https://api.themoviedb.org/3'
const IMAGE_BASE = 'https://image.tmdb.org/t/p/w500'

const token = (import.meta.env.VITE_TMDB_API_TOKEN as string | undefined)?.trim() || ''
const apiKey = (import.meta.env.VITE_TMDB_API_KEY as string | undefined)?.trim() || ''

export function hasTmdbConfig(): boolean {
  return token.length > 0 || apiKey.length > 0
}

export function posterUrl(path?: string | null): string | null {
  if (!path) return null
  return `${IMAGE_BASE}${path}`
}

interface TmdbResult {
  id: number
  title?: string
  name?: string
  media_type?: string
  release_date?: string
  first_air_date?: string
  overview?: string
  poster_path?: string | null
  backdrop_path?: string | null
  vote_average?: number
  genre_ids?: number[]
}

function mapResult(result: TmdbResult, mediaType: MediaType): MediaItem {
  return {
    id: result.id,
    mediaType,
    title: result.title || result.name || '',
    year: getYear(result.release_date || result.first_air_date),
    overview: result.overview || undefined,
    posterPath: result.poster_path,
    backdropPath: result.backdrop_path,
    voteAverage: result.vote_average,
    genreIds: result.genre_ids,
  }
}

async function fetchJson(path: string): Promise<unknown> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (token) headers.Authorization = `Bearer ${token}`
  const query = path.includes('?') ? '&' : '?'
  const url = token
    ? `${BASE}${path}${query}language=en-US`
    : `${BASE}${path}${query}api_key=${apiKey}&language=en-US`
  const res = await fetch(url, { headers })
  if (!res.ok) throw new Error(`TMDb request failed: ${res.status}`)
  return res.json()
}

interface SearchResponse {
  results?: TmdbResult[]
}

export async function searchMovies(query: string): Promise<MediaItem[]> {
  const data = (await fetchJson(`/search/movie?query=${encodeURIComponent(query)}&include_adult=false`)) as SearchResponse
  return (data.results ?? []).map((r) => mapResult(r, 'movie'))
}

export async function searchTv(query: string): Promise<MediaItem[]> {
  const data = (await fetchJson(`/search/tv?query=${encodeURIComponent(query)}&include_adult=false`)) as SearchResponse
  return (data.results ?? []).map((r) => mapResult(r, 'tv'))
}

export async function searchAll(query: string): Promise<MediaItem[]> {
  const [movies, tv] = await Promise.all([searchMovies(query), searchTv(query)])
  const merged = [...movies, ...tv]
  return merged.sort((a, b) => (b.voteAverage ?? 0) - (a.voteAverage ?? 0))
}

interface GenreListResponse {
  genres?: { id: number; name: string }[]
}

const genreCache: Record<MediaType, Map<number, string>> = { movie: new Map(), tv: new Map() }

/** Returns a map of genre id → name, loading both movie & tv genre lists once. */
export async function getGenreMap(): Promise<Map<number, string>> {
  const combined = new Map<number, string>()
  for (const type of ['movie', 'tv'] as const) {
    if (genreCache[type].size === 0) {
      const data = (await fetchJson(`/genre/${type}/list`)) as GenreListResponse
      for (const g of data.genres ?? []) genreCache[type].set(g.id, g.name)
    }
    for (const [id, name] of genreCache[type]) combined.set(id, name)
  }
  return combined
}

interface DetailResponse {
  runtime?: number
  episode_run_time?: number[]
}

/** Rough watch time in minutes. Movies use `runtime`; shows use `episode_run_time`. */
export async function fetchRuntimeMinutes(item: MediaItem): Promise<number | null> {
  if (!hasTmdbConfig()) return null
  try {
    const data = (await fetchJson(`/${item.mediaType}/${item.id}`)) as DetailResponse
    if (item.mediaType === 'movie') return data.runtime ?? null
    const times = data.episode_run_time?.filter((t) => t > 0)
    return times && times.length > 0 ? times[0] : null
  } catch {
    return null
  }
}