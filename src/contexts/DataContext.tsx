import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { averageCategoryScores } from '../constants'
import type { CategoryScores, ListKey, Lists, MediaItem, PlansMap, RatingsMap, UserRating, WatchPlan } from '../types'
import { LIST_KEYS } from '../types'
import { getRepo, readJsonFile, writeJsonFile } from '../utils/github'
import { loadListsCache, loadPlansCache, loadRatingsCache, saveListsCache, savePlansCache, saveRatingsCache } from '../utils/storage'
import { useAuth } from './AuthContext'

export type SyncState = 'loading' | 'idle' | 'syncing' | 'offline'

interface DataState {
  lists: Lists
  ratings: RatingsMap
  plans: PlansMap
}

interface DataContextValue {
  lists: Lists
  ratings: RatingsMap
  plans: PlansMap
  syncState: SyncState
  syncReason: string | null
  repoConfigured: boolean
  addToList: (item: MediaItem, listKey: ListKey) => void
  removeFromList: (listKey: ListKey, id: number) => void
  moveToList: (id: number, fromKey: ListKey, toKey: ListKey, overId?: number) => void
  reorderWithin: (listKey: ListKey, activeId: number, overId: number) => void
  rateItem: (mediaKey: string, scores: CategoryScores) => void
  removeMyRating: (mediaKey: string) => void
  planItem: (mediaKey: string, plan: WatchPlan) => void
  unplanItem: (mediaKey: string) => void
  refreshFromGitHub: () => Promise<void>
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const { session, getGitHubToken } = useAuth()
  const [data, setData] = useState<DataState>(() => ({
    lists: loadListsCache(),
    ratings: loadRatingsCache(),
    plans: loadPlansCache(),
  }))
  const [syncing, setSyncing] = useState(false)
  const [syncReason, setSyncReason] = useState<string | null>(null)

  const repoConfigured = getRepo() !== null
  const syncState: SyncState = syncing ? 'syncing' : repoConfigured ? 'idle' : 'offline'

  const persistAndSync = useCallback(
    (next: DataState) => {
      saveListsCache(next.lists)
      saveRatingsCache(next.ratings)
      savePlansCache(next.plans)

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
        writeJsonFile('data/plans.json', next.plans, token, `Update plans [${name}]`),
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
        if (next === prev) return prev
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
        let plans = prev.plans

        // Leaving the want-to-watch queue cancels any scheduling: clear the plan
        // so it no longer shows on the calendar.
        const mediaKey = `${item.mediaType}-${item.id}`
        if (fromKey === 'wantToWatch' && mediaKey in plans) {
          const { [mediaKey]: _removed, ...rest } = plans
          plans = rest
        }

        if (overId !== undefined) {
          const overIdx = target.findIndex((m) => m.id === overId)
          if (overIdx >= 0) {
            target.splice(overIdx, 0, item)
            return { ...prev, plans, lists: { ...prev.lists, [fromKey]: source, [toKey]: target } }
          }
        }

        target.push(item)
        return { ...prev, plans, lists: { ...prev.lists, [fromKey]: source, [toKey]: target } }
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

  const planItem = useCallback(
    (mediaKey: string, plan: WatchPlan) => {
      mutate((prev) => ({ ...prev, plans: { ...prev.plans, [mediaKey]: plan } }))
    },
    [mutate],
  )

  const unplanItem = useCallback(
    (mediaKey: string) => {
      mutate((prev) => {
        if (!(mediaKey in prev.plans)) return prev
        const { [mediaKey]: _removed, ...rest } = prev.plans
        return { ...prev, plans: rest }
      })
    },
    [mutate],
  )

  const advanceDuePlans = useCallback(() => {
    mutate((prev) => {
      const now = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      const nowKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`

      const wantToWatch = [...prev.lists.wantToWatch]
      const moved: MediaItem[] = []
      let plans = prev.plans

      for (let i = wantToWatch.length - 1; i >= 0; i--) {
        const item = wantToWatch[i]
        const key = `${item.mediaType}-${item.id}`
        const plan = plans[key]
        if (!plan) continue
        const dueStamp = `${plan.date} ${plan.startTime}`
        if (dueStamp > nowKey) continue
        wantToWatch.splice(i, 1)
        moved.push(item)
        const { [key]: _removed, ...rest } = plans
        plans = rest
      }

      if (moved.length === 0) return prev
      return {
        ...prev,
        plans,
        lists: {
          ...prev.lists,
          wantToWatch,
          currentlyWatching: [...prev.lists.currentlyWatching, ...moved],
        },
      }
    })
  }, [mutate])

  // Roll due scheduled watches into "currently watching" (never past that).
  useEffect(() => {
    advanceDuePlans()
    const id = window.setInterval(advanceDuePlans, 30_000)
    return () => window.clearInterval(id)
  }, [advanceDuePlans])

  const refreshFromGitHub = useCallback(async () => {
    const token = getGitHubToken()
    const [remoteLists, remoteRatings, remotePlans] = await Promise.all([
      readJsonFile<Lists>('data/lists.json', token),
      readJsonFile<RatingsMap>('data/ratings.json', token),
      readJsonFile<PlansMap>('data/plans.json', token),
    ])
    setData((prev) => {
      const next: DataState = { lists: prev.lists, ratings: prev.ratings, plans: prev.plans }
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
      if (remotePlans) {
        next.plans = remotePlans
        savePlansCache(next.plans)
      }
      return next
    })
  }, [getGitHubToken])

  useEffect(() => {
    refreshFromGitHub()
  }, [refreshFromGitHub])

  const value = useMemo<DataContextValue>(
    () => ({
      lists: data.lists,
      ratings: data.ratings,
      plans: data.plans,
      syncState,
      syncReason,
      repoConfigured,
      addToList,
      removeFromList,
      moveToList,
      reorderWithin,
      rateItem,
      removeMyRating,
      planItem,
      unplanItem,
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
      planItem,
      unplanItem,
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