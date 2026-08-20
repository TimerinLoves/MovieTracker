export type MediaType = 'movie' | 'tv'

export interface MediaItem {
  id: number
  mediaType: MediaType
  title: string
  year?: string
  overview?: string
  posterPath?: string | null
  backdropPath?: string | null
  voteAverage?: number
  genreIds?: number[]
  addedBy?: string
  addedAt?: string
}

export type ListKey = 'wantToWatch' | 'currentlyWatching' | 'watched'

export const LIST_KEYS: ListKey[] = ['wantToWatch', 'currentlyWatching', 'watched']

export interface Lists {
  wantToWatch: MediaItem[]
  currentlyWatching: MediaItem[]
  watched: MediaItem[]
}

export const EMPTY_LISTS: Lists = {
  wantToWatch: [],
  currentlyWatching: [],
  watched: [],
}

export interface CategoryScores {
  story: number
  acting: number
  visuals: number
  music: number
  rewatchability: number
  pacing: number
  emotionalImpact: number
}

export type CategoryKey = keyof CategoryScores

export interface RatingCategory {
  key: CategoryKey
  label: string
  description: string
}

export interface UserRating {
  scores: CategoryScores
  average: number
  ratedAt: string
  ratedByName?: string
}

export interface MovieRating {
  slot0?: UserRating
  slot1?: UserRating
}

/** Key format: `${mediaType}-${id}` */
export type RatingsMap = Record<string, MovieRating>

export interface WatchPlan {
  item: MediaItem
  date: string
  startTime: string
  durationMinutes?: number | null
}

/** Key format: `${mediaType}-${id}` */
export type PlansMap = Record<string, WatchPlan>

export const EMPTY_PLANS: PlansMap = {}

export interface AuthConfig {
  version: number
  users: { passwordHash: string }[]
}

export interface SessionData {
  slotId: number
  displayName: string
  loggedInAt: string
}

export interface ThemeDefinition {
  id: string
  name: string
  preview: string
}