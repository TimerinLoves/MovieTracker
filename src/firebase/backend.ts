import { collection, deleteDoc, doc, onSnapshot, setDoc } from 'firebase/firestore'
import type { DocumentData, QuerySnapshot } from 'firebase/firestore'
import { getDb } from './config'
import { firebaseEnabled } from './config'
import { deleteRepoFile, getRepo, readFolder, writeRepoFile } from '../utils/github'
import type { ListEntry, ListKey, Lists, MovieRating, PlansMap, RatingsMap, WatchPlan } from '../types'
import { LIST_KEYS } from '../types'

export interface RemoteData {
  lists: Lists
  ratings: RatingsMap
  plans: PlansMap
}

export interface DataBackend {
  start(onChange: (data: RemoteData) => void): () => void
  refresh(): Promise<void>
  writeList(key: string, entry: ListEntry): Promise<void>
  deleteList(key: string): Promise<void>
  writeRating(key: string, rating: MovieRating): Promise<void>
  deleteRating(key: string): Promise<void>
  writePlan(key: string, plan: WatchPlan): Promise<void>
  deletePlan(key: string): Promise<void>
}

const keyOf = (item: { mediaType: string; id: number }) => `${item.mediaType}-${item.id}`

function emptyLists(): Lists {
  return { wantToWatch: [], currentlyWatching: [], watched: [] }
}

function cloneLists(lists: Lists): Lists {
  return {
    wantToWatch: [...lists.wantToWatch],
    currentlyWatching: [...lists.currentlyWatching],
    watched: [...lists.watched],
  }
}

function listsFromEntries(entries: Record<string, ListEntry>): Lists {
  const lists = emptyLists()
  const orders: Record<string, number> = {}
  for (const [key, entry] of Object.entries(entries)) {
    const listKey: ListKey = (LIST_KEYS as string[]).includes(entry.listKey) ? entry.listKey : 'wantToWatch'
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
  return lists
}

function ratingsFromEntries(entries: Record<string, MovieRating>): RatingsMap {
  return entries
}

function plansFromEntries(entries: Record<string, WatchPlan>): PlansMap {
  return entries
}

// ---- Firestore backend (primary) ----
function createFirestoreBackend(): DataBackend {
  let unsubscribers: Array<() => void> = []

  return {
    start(onChange) {
      const db = getDb()
      if (!db) return () => {}
      const state: RemoteData = { lists: emptyLists(), ratings: {}, plans: {} }
      const emit = () =>
        onChange({ lists: cloneLists(state.lists), ratings: { ...state.ratings }, plans: { ...state.plans } })

      unsubscribers = [
        onSnapshot(collection(db, 'lists'), (snap: QuerySnapshot<DocumentData>) => {
          const map: Record<string, ListEntry> = {}
          snap.forEach((d) => (map[d.id] = d.data() as ListEntry))
          state.lists = listsFromEntries(map)
          emit()
        }),
        onSnapshot(collection(db, 'ratings'), (snap: QuerySnapshot<DocumentData>) => {
          const map: Record<string, MovieRating> = {}
          snap.forEach((d) => (map[d.id] = d.data() as MovieRating))
          state.ratings = ratingsFromEntries(map)
          emit()
        }),
        onSnapshot(collection(db, 'plans'), (snap: QuerySnapshot<DocumentData>) => {
          const map: Record<string, WatchPlan> = {}
          snap.forEach((d) => (map[d.id] = d.data() as WatchPlan))
          state.plans = plansFromEntries(map)
          emit()
        }),
      ]
      return () => unsubscribers.forEach((u) => u())
    },
    refresh: async () => {
      // Firestore listeners are live; nothing to refetch.
    },
    writeList: async (key, entry) => {
      const db = getDb()
      if (db) await setDoc(doc(db, 'lists', key), entry)
    },
    deleteList: async (key) => {
      const db = getDb()
      if (db) await deleteDoc(doc(db, 'lists', key))
    },
    writeRating: async (key, rating) => {
      const db = getDb()
      if (db) await setDoc(doc(db, 'ratings', key), rating)
    },
    deleteRating: async (key) => {
      const db = getDb()
      if (db) await deleteDoc(doc(db, 'ratings', key))
    },
    writePlan: async (key, plan) => {
      const db = getDb()
      if (db) await setDoc(doc(db, 'plans', key), plan)
    },
    deletePlan: async (key) => {
      const db = getDb()
      if (db) await deleteDoc(doc(db, 'plans', key))
    },
  }
}

// ---- GitHub backend (fallback when Firebase is not configured) ----
function createGitHubBackend(getToken: () => string | null): DataBackend {
  let stopped = false
  let interval: ReturnType<typeof setInterval> | null = null

  const load = async (onChange: (data: RemoteData) => void) => {
    const token = getToken()
    if (!getRepo()) {
      onChange({ lists: emptyLists(), ratings: {}, plans: {} })
      return
    }
    const [remoteLists, remoteRatings, remotePlans] = await Promise.all([
      readFolder<ListEntry>('lists', token),
      readFolder<MovieRating>('ratings', token),
      readFolder<WatchPlan>('plans', token),
    ])
    if (stopped) return
    onChange({
      lists: listsFromEntries(remoteLists),
      ratings: ratingsFromEntries(remoteRatings),
      plans: plansFromEntries(remotePlans),
    })
  }

  return {
    start(onChange) {
      stopped = false
      void load(onChange)
      interval = setInterval(() => void load(onChange), 30_000)
      return () => {
        stopped = true
        if (interval) clearInterval(interval)
      }
    },
    refresh: async () => {
      // Triggered manually from settings; the interval handles periodic sync.
    },
    writeList: async (key, entry) => {
      const token = getToken()
      if (token) await writeRepoFile('lists', key, entry, token, `Update ${key}`)
    },
    deleteList: async (key) => {
      const token = getToken()
      if (token) await deleteRepoFile('lists', key, token, `Delete ${key}`)
    },
    writeRating: async (key, rating) => {
      const token = getToken()
      if (token) await writeRepoFile('ratings', key, rating, token, `Update ${key}`)
    },
    deleteRating: async (key) => {
      const token = getToken()
      if (token) await deleteRepoFile('ratings', key, token, `Delete ${key}`)
    },
    writePlan: async (key, plan) => {
      const token = getToken()
      if (token) await writeRepoFile('plans', key, plan, token, `Update ${key}`)
    },
    deletePlan: async (key) => {
      const token = getToken()
      if (token) await deleteRepoFile('plans', key, token, `Delete ${key}`)
    },
  }
}

export function createBackend(getToken: () => string | null): DataBackend {
  return firebaseEnabled ? createFirestoreBackend() : createGitHubBackend(getToken)
}
