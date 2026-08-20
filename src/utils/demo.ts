import type { MediaItem } from '../types'

/** Fallback data used when no TMDb API token/key is configured (demo mode). */
export function demoSearch(query: string): MediaItem[] {
  const q = query.trim().toLowerCase()
  const all = DEMO_MEDIA
  if (!q) return all.slice(0, 10)
  return all.filter(
    (m) => m.title.toLowerCase().includes(q) || (m.overview ?? '').toLowerCase().includes(q),
  )
}

export const DEMO_MEDIA: MediaItem[] = [
  { id: 27205, mediaType: 'movie', title: 'Inception', year: '2010', overview: 'A thief who steals corporate secrets through dream-sharing technology.', posterPath: null, voteAverage: 8.4 },
  { id: 157336, mediaType: 'movie', title: 'Interstellar', year: '2014', overview: "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.", posterPath: null, voteAverage: 8.4 },
  { id: 194662, mediaType: 'movie', title: 'The Grand Budapest Hotel', year: '2014', overview: 'The adventures of Gustave H and his lobby boy Zero.', posterPath: null, voteAverage: 8.1 },
  { id: 603, mediaType: 'movie', title: 'The Matrix', year: '1999', overview: 'A computer hacker learns the truth about his reality.', posterPath: null, voteAverage: 8.2 },
  { id: 769, mediaType: 'movie', title: 'GoodFellas', year: '1990', overview: 'The story of Henry Hill and his life in the mob.', posterPath: null, voteAverage: 8.5 },
  { id: 155, mediaType: 'movie', title: 'The Dark Knight', year: '2008', overview: 'Batman faces the Joker in Gotham City.', posterPath: null, voteAverage: 8.5 },
  { id: 1399, mediaType: 'tv', title: 'Game of Thrones', year: '2011', overview: 'Nine noble families fight for control over the lands of Westeros.', posterPath: null, voteAverage: 8.2 },
  { id: 94997, mediaType: 'tv', title: 'House of the Dragon', year: '2022', overview: 'The Targaryen dynasty at the height of its power.', posterPath: null, voteAverage: 8.4 },
  { id: 1396, mediaType: 'tv', title: 'Breaking Bad', year: '2008', overview: 'A chemistry teacher diagnosed with cancer turns to manufacturing meth.', posterPath: null, voteAverage: 8.6 },
  { id: 456, mediaType: 'tv', title: 'The Simpsons', year: '1989', overview: 'The satiric adventures of a working-class family in the misfit city of Springfield.', posterPath: null, voteAverage: 7.6 },
  { id: 76479, mediaType: 'tv', title: 'The Boys', year: '2019', overview: "A group of vigilantes set out to take down corrupt superheroes.", posterPath: null, voteAverage: 8.4 },
  { id: 1636, mediaType: 'tv', title: 'The Mandalorian', year: '2019', overview: 'A lone gunfighter makes his way through the outer reaches of the galaxy.', posterPath: null, voteAverage: 8.4 },
]