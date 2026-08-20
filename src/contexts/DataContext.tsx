import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { averageCategoryScores } from '../constants'
import type { CategoryScores, ListKey, Lists, MediaItem, RatingsMap, UserRating } from '../types'
import { LIST_KEYS } from '../types'
import { getRepo, readJsonFile, writeJsonFile } from '../utils/github'
import { loadListsCache, loadRatingsCache, saveListsCache, saveRatingsCache } from '../utils/storage'
import { useAuth } from './AuthContext'

export type SyncState = 'loading' | 'idle' | 'syncing' | 'offline'

interface DataState {
  lists: Lists
  ratings: RatingsMap
}

interface DataContextValue {
  lists: Lists
  ratings: RatingsMap
  syncState: SyncState
  syncReason: string | null
  repoConfigured: boolean
  addToList: (item: MediaItem, listKey: ListKey) => void
  removeFromList: (listKey: ListKey, id: number) => void
  moveToList: (id: number, fromKey: ListKey, toKey: ListKey, overId?: number) => void
  reorderWithin: (listKey: ListKey, activeId: number, overId: number) => void
  rateItem: (mediaKey: string, scores: CategoryScores) => void
  removeMyRating: (mediaKey: string) => void
  refreshFromGitHub: () => Promise<void>
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const { session, getGitHubToken } = useAuth()
  const [data, setData] = useState<DataState>(() => ({
    lists: loadListsCache(),
    ratings: loadRatingsCache(),
  }))
  const [syncing, setSyncing] = useState(false)
  const [syncReason, setSyncReason] = useState<string | null>(null)

  const repoConfigured = getRepo() !== null
  const syncState: SyncState = syncing ? 'syncing' : repoConfigured ? 'idle' : 'offline'

  const persistAndSync = useCallback(
    (next: DataState) => {
      saveListsCache(next.lists)
      saveRatingsCache(next.ratings)

      const token = getGitHubToken()
      if (!repoConfigured) {
        setSyncReason('GitHub repo not configured - data stays in this browser for now.')
        return
      }
      if (!token) {
        setSyncReason('Logged in, but the GitHub token is locked. Unlock it in Settings to sync.')
        return
      }

      setSyncing(true)
      const name = session?.displayName ?? 'unknown'
      Promise.all([
        writeJsonFile('data/lists.json', next.lists, token, `Update lists [${name}]`),
        writeJsonFile('data/ratings.json', next.ratings, token, `Update ratings [${name}]`),
      ])
        .then((results) => {
          setSyncReason(results.some((r) => !r) ? 'Failed to sync to GitHub.' : null)
        })
        .catch(() => setSyncReason('Failed to sync to GitHub.'))
        .finally(() => setSyncing(false))
    },
    [repoConfigured, getGitHubToken, session],
  )

  const mutate = useCallback(
    (updater: (prev: DataState) => DataState) => {
      setData((prev) => {
        const next = updater(prev)
        persistAndSync(next)
        return next
      })
    },
    [persistAndSync],
  )

  const addToList = useCallback(
    (item: MediaItem, listKey: ListKey) => {
      mutate((prev) => {
        const exists = LIST_KEYS.some((k) =>
          prev.lists[k].some((m) => m.id === item.id && m.mediaType === item.mediaType),
        )
        if (exists) return prev
        const stamped: MediaItem = {
          ...item,
          addedBy: session?.displayName,
          addedAt: new Date().toISOString(),
        }
        return { ...prev, lists: { ...prev.lists, [listKey]: [...prev.lists[listKey], stamped] } }
      })
    },
    [mutate, session],
  )

  const removeFromList = useCallback(
    (listKey: ListKey, id: number) => {
      mutate((prev) => ({
        ...prev,
        lists: { ...prev.lists, [listKey]: prev.lists[listKey].filter((m) => m.id !== id) },
      }))
    },
    [mutate],
  )

  const moveToList = useCallback(
    (id: number, fromKey: ListKey, toKey: ListKey, overId?: number) => {
      if (fromKey === toKey) return
      mutate((prev) => {
        const item = prev.lists[fromKey].find((m) => m.id === id)
        if (!item) return prev
        const source = prev.lists[fromKey].filter((m) => m.id !== id)
        const target = [...prev.lists[toKey]]

        if (overId !== undefined) {
          const overIdx = target.findIndex((m) => m.id === overId)
          if (overIdx >= 0) {
            target.splice(overIdx, 0, item)
            return { ...prev, lists: { ...prev.lists, [fromKey]: source, [toKey]: target } }
          }
        }

        target.push(item)
        return { ...prev, lists: { ...prev.lists, [fromKey]: source, [toKey]: target } }
      })
    },
    [mutate],
  )

  const reorderWithin = useCallback(
    (listKey: ListKey, activeId: number, overId: number) => {
      if (activeId === overId) return
      mutate((prev) => {
        const items = [...prev.lists[listKey]]
        const fromIdx = items.findIndex((m) => m.id === activeId)
        const toIdx = items.findIndex((m) => m.id === overId)
        if (fromIdx < 0 || toIdx < 0) return prev
        const [moved] = items.splice(fromIdx, 1)
        items.splice(toIdx, 0, moved)
        return { ...prev, lists: { ...prev.lists, [listKey]: items } }
      })
    },
    [mutate],
  )

  const rateItem = useCallback(
    (mediaKey: string, scores: CategoryScores) => {
      if (!session) return
      const slotKey = `slot${session.slotId}` as 'slot0' | 'slot1'
      mutate((prev) => {
        const rating: UserRating = {
          scores,
          average: averageCategoryScores(scores),
          ratedAt: new Date().toISOString(),
          ratedByName: session.displayName,
        }
        const existing = prev.ratings[mediaKey] ?? {}
        return {
          ...prev,
          ratings: { ...prev.ratings, [mediaKey]: { ...existing, [slotKey]: rating } },
        }
      })
    },
    [mutate, session],
  )

  const removeMyRating = useCallback(
    (mediaKey: string) => {
      if (!session) return
      const slotKey = `slot${session.slotId}` as 'slot0' | 'slot1'
      mutate((prev) => {
        const movie = prev.ratings[mediaKey]
        if (!movie) return prev
        const { [slotKey]: _removed, ...rest } = movie
        return { ...prev, ratings: { ...prev.ratings, [mediaKey]: rest } }
      })
    },
    [mutate, session],
  )

  const refreshFromGitHub = useCallback(async () => {
    const [remoteLists, remoteRatings] = await Promise.all([
      readJsonFile<Lists>('data/lists.json'),
      readJsonFile<RatingsMap>('data/ratings.json'),
    ])
    setData((prev) => {
      const next: DataState = { lists: prev.lists, ratings: prev.ratings }
      if (remoteLists) {
        next.lists = {
          wantToWatch: remoteLists.wantToWatch ?? [],
          currentlyWatching: remoteLists.currentlyWatching ?? [],
          watched: remoteLists.watched ?? [],
        }
        saveListsCache(next.lists)
      }
      if (remoteRatings) {
        next.ratings = remoteRatings
        saveRatingsCache(next.ratings)
      }
      return next
    })
  }, [])

  useEffect(() => {
    refreshFromGitHub()
  }, [refreshFromGitHub])

  const value = useMemo<DataContextValue>(
    () => ({
      lists: data.lists,
      ratings: data.ratings,
      syncState,
      syncReason,
      repoConfigured,
      addToList,
      removeFromList,
      moveToList,
      reorderWithin,
      rateItem,
      removeMyRating,
      refreshFromGitHub,
    }),
    [
      data,
      syncState,
      syncReason,
      repoConfigured,
      addToList,
      removeFromList,
      moveToList,
      reorderWithin,
      rateItem,
      removeMyRating,
      refreshFromGitHub,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}