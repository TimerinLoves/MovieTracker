import type { CategoryScores, RatingCategory } from '../types'

export const RATING_CATEGORIES: RatingCategory[] = [
  { key: 'story', label: 'Story', description: 'How good was the plot/writing?' },
  { key: 'acting', label: 'Acting', description: 'Quality of the performances' },
  { key: 'visuals', label: 'Visuals', description: 'Cinematography, effects, art direction' },
  { key: 'music', label: 'Music / Sound', description: 'Score, soundtrack, sound design' },
  { key: 'rewatchability', label: 'Rewatchability', description: 'Would you watch it again?' },
  { key: 'pacing', label: 'Pacing', description: 'Did it flow well, or drag?' },
  { key: 'emotionalImpact', label: 'Emotional Impact', description: 'Did it make you feel something?' },
]

export function averageCategoryScores(scores: CategoryScores): number {
  const values = Object.values(scores)
  const sum = values.reduce((acc, v) => acc + v, 0)
  return round1(sum / values.length)
}

export function combineRatings(a?: number, b?: number): number | null {
  if (a === undefined || b === undefined) return null
  return round1((a + b) / 2)
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export function getYear(dateString?: string): string | undefined {
  if (!dateString) return undefined
  return dateString.slice(0, 4)
}

export function ratingKey(mediaType: string, id: number): string {
  return `${mediaType}-${id}`
}