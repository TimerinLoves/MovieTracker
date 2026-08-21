import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { averageCategoryScores } from '../constants'
import type { CategoryScores, ListEntry, ListKey, Lists, MediaItem, MovieRating, OrderMap, PlansMap, RatingsMap, UserRating, WatchPlan } from '../types'
import { LIST_KEYS } from '../types'
import { getRepo, readFolder, writeRepoFile, deleteRepoFile } from '../utils/github'
import { loadListsCache, loadOrdersCache, loadPlansCache, loadRatingsCache, saveListsCache, saveOrdersCache, savePlansCache, saveRatingsCache } from '../utils/storage'
import { useAuth } from './AuthContext'

export type SyncState = 'loading' | 'idle' | 'syncing' | 'offline'

interface DataState {
  lists: Lists
  ratings: RatingsMap
  plans: PlansMap
  orders: OrderMap
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

const keyOf = (item: MediaItem) => `${item.mediaType}-${item.id}`

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const { session, getGitHubToken, getReadToken } = useAuth()
  const [data, setData] = useState<DataState>(() => {
    const lists = loadListsCache()
    const orders = loadOrdersCache()
    // Seed orders from current list positions when missing.
    for (const listKey of LIST_KEYS) {
      lists[listKey].forEach((m, i) => {
        const k = keyOf(m)
        if (!(k in orders)) orders[k] = i
      })
    }
    return {
      lists,
      ratings: loadRatingsCache(),
      plans: loadPlansCache(),
      orders,
    }
  })
  const [syncing, setSyncing] = useState(false)
  const [syncReason, setSyncReason] = useState<string | null>(null)

  const repoConfigured = getRepo() !== null
  const syncState: SyncState = syncing ? 'syncing' : repoConfigured ? 'idle' : 'offline'

  const persistCache = useCallback((next: DataState) => {
    saveListsCache(next.lists)
    saveRatingsCache(next.ratings)
    savePlansCache(next.plans)
    saveOrdersCache(next.orders)
  }, [])

  // Local-only state update + offline cache. GitHub writes are done per-change
  // in each action so individual edits never clobber each other.
  const mutate = useCallback(
    (updater: (prev: DataState) => DataState) => {
      setData((prev) => {
        const next = updater(prev)
        if (next === prev) return prev
        persistCache(next)
        return next
      })
    },
    [persistCache],
  )

  const syncWrite = useCallback(
    (folder: string, key: string, payload: unknown, message: string) => {
      const token = getGitHubToken()
      if (!repoConfigured || !token) {
        if (!repoConfigured) setSyncReason('GitHub repo not configured - data stays in this browser for now.')
        return
      }
      setSyncing(true)
      writeRepoFile(folder, key, payload, token, message)
        .then((ok) => setSyncReason(ok ? null : 'Failed to sync to GitHub.'))
        .catch(() => setSyncReason('Failed to sync to GitHub.'))
        .finally(() => setSyncing(false))
    },
    [repoConfigured, getGitHubToken],
  )

  const syncDelete = useCallback(
    (folder: string, key: string, message: string) => {
      const token = getGitHubToken()
      if (!repoConfigured || !token) return
      setSyncing(true)
      deleteRepoFile(folder, key, token, message)
        .then((ok) => setSyncReason(ok ? null : 'Failed to sync to GitHub.'))
        .catch(() => setSyncReason('Failed to sync to GitHub.'))
        .finally(() => setSyncing(false))
    },
    [repoConfigured, getGitHubToken],
  )

  const addToList = useCallback(
    (item: MediaItem, listKey: ListKey) => {
      const key = keyOf(item)
      const order = Date.now()
      const name = session?.displayName ?? 'unknown'
      mutate((prev) => {
        const exists = LIST_KEYS.some((k) => prev.lists[k].some((m) => m.id === item.id && m.mediaType === item.mediaType))
        if (exists) return prev
        const stamped: MediaItem = { ...item, addedBy: session?.displayName, addedAt: new Date().toISOString() }
        return {
          ...prev,
          orders: { ...prev.orders, [key]: order },
          lists: { ...prev.lists, [listKey]: [...prev.lists[listKey], stamped] },
        }
      })
      syncWrite('lists', key, { listKey, order, item: { ...item, addedBy: session?.displayName, addedAt: new Date().toISOString() } } as ListEntry, `Add to ${listKey} [${name}]`)
    },
    [mutate, session, syncWrite],
  )

  const removeFromList = useCallback(
    (listKey: ListKey, id: number) => {
      const item = data.lists[listKey].find((m) => m.id === id)
      if (!item) return
      const key = keyOf(item)
      const name = session?.displayName ?? 'unknown'
      mutate((prev) => {
        const { [key]: _removed, ...rest } = prev.orders
        return {
          ...prev,
          orders: rest,
          lists: { ...prev.lists, [listKey]: prev.lists[listKey].filter((m) => m.id !== id) },
        }
      })
      syncDelete('lists', key, `Remove from ${listKey} [${name}]`)
    },
    [mutate, data.lists, session, syncDelete],
  )

  const computeOrder = (toKey: ListKey, overId?: number): number => {
    const target = data.lists[toKey]
    if (overId == null) return Date.now()
    const overIdx = target.findIndex((m) => m.id === overId)
    if (overIdx < 0) return Date.now()
    const beforeKey = overIdx > 0 ? keyOf(target[overIdx - 1]) : null
    const afterKey = overIdx < target.length ? keyOf(target[overIdx]) : null
    const beforeOrder = beforeKey != null ? data.orders[beforeKey] : null
    const afterOrder = afterKey != null ? data.orders[afterKey] : null
    if (beforeOrder != null && afterOrder != null) return (beforeOrder + afterOrder) / 2
    if (beforeOrder != null) return beforeOrder + 1
    if (afterOrder != null) return afterOrder - 1
    return Date.now()
  }

  const moveToList = useCallback(
    (id: number, fromKey: ListKey, toKey: ListKey, overId?: number) => {
      if (fromKey === toKey) return
      const item = data.lists[fromKey].find((m) => m.id === id)
      if (!item) return
      const key = keyOf(item)
      const order = computeOrder(toKey, overId)
      const name = session?.displayName ?? 'unknown'
      const wasPlan = key in data.plans
      mutate((prev) => {
        const source = prev.lists[fromKey].filter((m) => m.id !== id)
        const target = [...prev.lists[toKey]]
        let plans = prev.plans
        if (fromKey === 'wantToWatch' && key in plans) {
          const { [key]: _removed, ...rest } = plans
          plans = rest
        }
        if (overId != null) {
          const overIdx = target.findIndex((m) => m.id === overId)
          if (overIdx >= 0) {
            target.splice(overIdx, 0, item)
            return { ...prev, orders: { ...prev.orders, [key]: order }, plans, lists: { ...prev.lists, [fromKey]: source, [toKey]: target } }
          }
        }
        target.push(item)
        return { ...prev, orders: { ...prev.orders, [key]: order }, plans, lists: { ...prev.lists, [fromKey]: source, [toKey]: target } }
      })
      syncWrite('lists', key, { listKey: toKey, order, item } as ListEntry, `Move to ${toKey} [${name}]`)
      if (fromKey === 'wantToWatch' && wasPlan) syncDelete('plans', key, `Remove plan (moved to ${toKey}) [${name}]`)
    },
    [mutate, data.lists, data.plans, data.orders, session, syncWrite, syncDelete],
  )

  const reorderWithin = useCallback(
    (listKey: ListKey, activeId: number, overId: number) => {
      if (activeId === overId) return
      const item = data.lists[listKey].find((m) => m.id === activeId)
      if (!item) return
      const key = keyOf(item)
      const order = computeOrder(listKey, overId)
      mutate((prev) => {
        const items = [...prev.lists[listKey]]
        const fromIdx = items.findIndex((m) => m.id === activeId)
        const toIdx = items.findIndex((m) => m.id === overId)
        if (fromIdx < 0 || toIdx < 0) return prev
        const [moved] = items.splice(fromIdx, 1)
        items.splice(toIdx, 0, moved)
        return { ...prev, orders: { ...prev.orders, [key]: order }, lists: { ...prev.lists, [listKey]: items } }
      })
      syncWrite('lists', key, { listKey, order, item } as ListEntry, `Reorder in ${listKey} [${session?.displayName ?? 'unknown'}]`)
    },
    [mutate, data.lists, data.orders, session, syncWrite],
  )

  const rateItem = useCallback(
    (mediaKey: string, scores: CategoryScores) => {
      if (!session) return
      const slotKey = `slot${session.slotId}` as 'slot0' | 'slot1'
      const rating: UserRating = {
        scores,
        average: averageCategoryScores(scores),
        ratedAt: new Date().toISOString(),
        ratedByName: session.displayName,
      }
      const existing = data.ratings[mediaKey] ?? {}
      const nextRating = { ...existing, [slotKey]: rating }
      mutate((prev) => {
        const cur = prev.ratings[mediaKey] ?? {}
        return { ...prev, ratings: { ...prev.ratings, [mediaKey]: { ...cur, [slotKey]: rating } } }
      })
      syncWrite('ratings', mediaKey, nextRating, `Rate ${mediaKey} [${session.displayName}]`)
    },
    [mutate, data.ratings, session, syncWrite],
  )

  const removeMyRating = useCallback(
    (mediaKey: string) => {
      if (!session) return
      const slotKey = `slot${session.slotId}` as 'slot0' | 'slot1'
      const movie = data.ratings[mediaKey]
      if (!movie) return
      const { [slotKey]: _removed, ...rest } = movie
      mutate((prev) => {
        const cur = prev.ratings[mediaKey]
        if (!cur) return prev
        const { [slotKey]: _r, ...restNext } = cur
        return { ...prev, ratings: { ...prev.ratings, [mediaKey]: restNext } }
      })
      const name = session.displayName
      if (Object.keys(rest).length === 0) syncDelete('ratings', mediaKey, `Remove rating ${mediaKey} [${name}]`)
      else syncWrite('ratings', mediaKey, rest, `Update rating ${mediaKey} [${name}]`)
    },
    [mutate, data.ratings, session, syncWrite, syncDelete],
  )

  const planItem = useCallback(
    (mediaKey: string, plan: WatchPlan) => {
      mutate((prev) => ({ ...prev, plans: { ...prev.plans, [mediaKey]: plan } }))
      syncWrite('plans', mediaKey, plan, `Plan ${mediaKey} [${session?.displayName ?? 'unknown'}]`)
    },
    [mutate, session, syncWrite],
  )

  const unplanItem = useCallback(
    (mediaKey: string) => {
      if (!(mediaKey in data.plans)) return
      mutate((prev) => {
        if (!(mediaKey in prev.plans)) return prev
        const { [mediaKey]: _removed, ...rest } = prev.plans
        return { ...prev, plans: rest }
      })
      syncDelete('plans', mediaKey, `Unplan ${mediaKey} [${session?.displayName ?? 'unknown'}]`)
    },
    [mutate, data.plans, session, syncDelete],
  )

  const advanceDuePlans = useCallback(() => {
    const dueKeys: string[] = []
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const nowKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`

    const wantToWatch = [...data.lists.wantToWatch]
    const moved: MediaItem[] = []
    for (let i = wantToWatch.length - 1; i >= 0; i--) {
      const item = wantToWatch[i]
      const key = keyOf(item)
      const plan = data.plans[key]
      if (!plan) continue
      if (`${plan.date} ${plan.startTime}` > nowKey) continue
      wantToWatch.splice(i, 1)
      moved.push(item)
      dueKeys.push(key)
    }
    if (moved.length === 0) return

    const name = session?.displayName ?? 'unknown'
    mutate((prev) => {
      let plans = prev.plans
      for (const key of dueKeys) {
        if (key in plans) {
          const { [key]: _removed, ...rest } = plans
          plans = rest
        }
      }
      return {
        ...prev,
        plans,
        lists: {
          ...prev.lists,
          wantToWatch: prev.lists.wantToWatch.filter((m) => !dueKeys.includes(keyOf(m))),
          currentlyWatching: [...prev.lists.currentlyWatching, ...moved],
        },
      }
    })
    for (const item of moved) {
      const key = keyOf(item)
      syncWrite('lists', key, { listKey: 'currentlyWatching', order: Date.now(), item } as ListEntry, `Auto-advance ${key} [${name}]`)
      syncDelete('plans', key, `Auto-advance plan ${key} [${name}]`)
    }
  }, [mutate, data.lists.wantToWatch, data.plans, session, syncWrite, syncDelete])

  // Roll due scheduled watches into "currently watching" (never past that).
  useEffect(() => {
    advanceDuePlans()
    const id = window.setInterval(advanceDuePlans, 30_000)
    return () => window.clearInterval(id)
  }, [advanceDuePlans])

  const refreshFromGitHub = useCallback(async () => {
    const token = getReadToken()
    const [remoteLists, remoteRatings, remotePlans] = await Promise.all([
      readFolder<ListEntry>('data/lists', token),
      readFolder<MovieRating>('data/ratings', token),
      readFolder<WatchPlan>('data/plans', token),
    ])

    setData((prev) => {
      const orders: OrderMap = { ...prev.orders }
      const lists: Lists = { wantToWatch: [], currentlyWatching: [], watched: [] }

      for (const [key, entry] of Object.entries(remoteLists)) {
        const listKey = LIST_KEYS.includes(entry.listKey) ? entry.listKey : 'wantToWatch'
        lists[listKey].push(entry.item)
        if (entry.order != null) orders[key] = entry.order
      }
      for (const listKey of LIST_KEYS) {
        lists[listKey].forEach((m, i) => {
          const k = keyOf(m)
          if (!(k in orders)) orders[k] = i
        })
        lists[listKey].sort((a, b) => (orders[keyOf(a)] ?? 0) - (orders[keyOf(b)] ?? 0))
      }

      const ratings = remoteRatings ?? prev.ratings
      const plans = remotePlans ?? prev.plans
      const next: DataState = { lists, ratings, plans, orders }
      persistCache(next)
      return next
    })
  }, [getReadToken, persistCache])

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
