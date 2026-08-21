import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { averageCategoryScores } from '../constants'
import type { CategoryScores, ListEntry, ListKey, Lists, MediaItem, OrderMap, PlansMap, RatingsMap, UserRating, WatchPlan } from '../types'
import { LIST_KEYS } from '../types'
import { getRepo } from '../utils/github'
import { loadListsCache, loadOrdersCache, loadPlansCache, loadRatingsCache, saveListsCache, saveOrdersCache, savePlansCache, saveRatingsCache } from '../utils/storage'
import { firebaseEnabled } from '../firebase/config'
import { createBackend, type DataBackend } from '../firebase/backend'
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
  refresh: () => Promise<void>
}

const keyOf = (item: MediaItem) => `${item.mediaType}-${item.id}`

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const { session, getGitHubToken } = useAuth()
  const backend: DataBackend = useMemo(() => createBackend(getGitHubToken), [getGitHubToken])

  const [data, setData] = useState<DataState>(() => {
    const lists = loadListsCache()
    const orders = loadOrdersCache()
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

  const remoteConfigured = firebaseEnabled || getRepo() !== null
  const syncState: SyncState = syncing ? 'syncing' : remoteConfigured ? 'idle' : 'offline'

  const persistCache = useCallback((next: DataState) => {
    saveListsCache(next.lists)
    saveRatingsCache(next.ratings)
    savePlansCache(next.plans)
    saveOrdersCache(next.orders)
  }, [])

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

  // Fire-and-forget backend write that also drives the sync indicator.
  const runWrite = useCallback((p: Promise<void>) => {
    setSyncing(true)
    p.then(() => setSyncReason(null))
      .catch(() => setSyncReason('Sync failed.'))
      .finally(() => setSyncing(false))
  }, [])

  const addToList = useCallback(
    (item: MediaItem, listKey: ListKey) => {
      const key = keyOf(item)
      const order = Date.now()
      const stamped: MediaItem = { ...item, addedBy: session?.displayName, addedAt: new Date().toISOString() }
      mutate((prev) => {
        const exists = LIST_KEYS.some((k) => prev.lists[k].some((m) => m.id === item.id && m.mediaType === item.mediaType))
        if (exists) return prev
        return {
          ...prev,
          orders: { ...prev.orders, [key]: order },
          lists: { ...prev.lists, [listKey]: [...prev.lists[listKey], stamped] },
        }
      })
      const entry: ListEntry = { listKey, order, item: stamped }
      runWrite(backend.writeList(key, entry))
    },
    [mutate, session, backend, runWrite],
  )

  const removeFromList = useCallback(
    (listKey: ListKey, id: number) => {
      const item = data.lists[listKey].find((m) => m.id === id)
      if (!item) return
      const key = keyOf(item)
      mutate((prev) => {
        const { [key]: _removed, ...rest } = prev.orders
        return {
          ...prev,
          orders: rest,
          lists: { ...prev.lists, [listKey]: prev.lists[listKey].filter((m) => m.id !== id) },
        }
      })
      runWrite(backend.deleteList(key))
    },
    [mutate, data.lists, backend, runWrite],
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
      runWrite(backend.writeList(key, { listKey: toKey, order, item }))
      if (fromKey === 'wantToWatch' && wasPlan) runWrite(backend.deletePlan(key))
    },
    [mutate, data.lists, data.plans, data.orders, backend, runWrite],
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
      runWrite(backend.writeList(key, { listKey, order, item }))
    },
    [mutate, data.lists, data.orders, backend, runWrite],
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
      const nextRating = { ...(data.ratings[mediaKey] ?? {}), [slotKey]: rating }
      mutate((prev) => {
        const cur = prev.ratings[mediaKey] ?? {}
        return { ...prev, ratings: { ...prev.ratings, [mediaKey]: { ...cur, [slotKey]: rating } } }
      })
      runWrite(backend.writeRating(mediaKey, nextRating))
    },
    [mutate, data.ratings, session, backend, runWrite],
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
      if (Object.keys(rest).length === 0) runWrite(backend.deleteRating(mediaKey))
      else runWrite(backend.writeRating(mediaKey, rest))
    },
    [mutate, data.ratings, session, backend, runWrite],
  )

  const planItem = useCallback(
    (mediaKey: string, plan: WatchPlan) => {
      mutate((prev) => ({ ...prev, plans: { ...prev.plans, [mediaKey]: plan } }))
      runWrite(backend.writePlan(mediaKey, plan))
    },
    [mutate, backend, runWrite],
  )

  const unplanItem = useCallback(
    (mediaKey: string) => {
      if (!(mediaKey in data.plans)) return
      mutate((prev) => {
        if (!(mediaKey in prev.plans)) return prev
        const { [mediaKey]: _removed, ...rest } = prev.plans
        return { ...prev, plans: rest }
      })
      runWrite(backend.deletePlan(mediaKey))
    },
    [mutate, data.plans, backend, runWrite],
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
      runWrite(backend.writeList(key, { listKey: 'currentlyWatching', order: Date.now(), item }))
      runWrite(backend.deletePlan(key))
    }
  }, [mutate, data.lists.wantToWatch, data.plans, backend, runWrite])

  useEffect(() => {
    advanceDuePlans()
    const id = window.setInterval(advanceDuePlans, 30_000)
    return () => window.clearInterval(id)
  }, [advanceDuePlans])

  // Subscribe to the active backend (Firestore when configured, else GitHub).
  useEffect(() => {
    const unsub = backend.start((remote) => {
      setData((prev) => {
        const orders: OrderMap = { ...prev.orders }
        for (const listKey of LIST_KEYS) {
          remote.lists[listKey].forEach((m, i) => {
            const k = keyOf(m)
            if (!(k in orders)) orders[k] = i
          })
        }
        const next: DataState = { lists: remote.lists, ratings: remote.ratings, plans: remote.plans, orders }
        persistCache(next)
        return next
      })
    })
    return unsub
  }, [backend, persistCache])

  const refresh = useCallback(async () => {
    await backend.refresh()
  }, [backend])

  const value = useMemo<DataContextValue>(
    () => ({
      lists: data.lists,
      ratings: data.ratings,
      plans: data.plans,
      syncState,
      syncReason,
      repoConfigured: remoteConfigured,
      addToList,
      removeFromList,
      moveToList,
      reorderWithin,
      rateItem,
      removeMyRating,
      planItem,
      unplanItem,
      refresh,
    }),
    [
      data,
      syncState,
      syncReason,
      remoteConfigured,
      addToList,
      removeFromList,
      moveToList,
      reorderWithin,
      rateItem,
      removeMyRating,
      planItem,
      unplanItem,
      refresh,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
