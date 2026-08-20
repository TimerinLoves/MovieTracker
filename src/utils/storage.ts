import type { Lists, PlansMap, RatingsMap, SessionData } from '../types'
import { EMPTY_PLANS, EMPTY_LISTS } from '../types'

const PREFIX = 'mt:'

function get(key: string): string | null {
  try {
    return localStorage.getItem(PREFIX + key)
  } catch {
    return null
  }
}

function set(key: string, value: string): void {
  try {
    localStorage.setItem(PREFIX + key, value)
  } catch {
    // storage unavailable (private mode) - ignore, in-memory state still works
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    // ignore
  }
}

// ---- session ----
export function loadSession(): SessionData | null {
  const raw = get('session')
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function saveSession(session: SessionData): void {
  set('session', JSON.stringify(session))
}

export function clearSession(): void {
  remove('session')
}

// ---- GitHub token per slot (stored encrypted, never plaintext) ----
export function loadEncryptedGitHubToken(slotId: number): string | null {
  return get(`ghToken.${slotId}`)
}

export function saveEncryptedGitHubToken(slotId: number, encrypted: string): void {
  set(`ghToken.${slotId}`, encrypted)
}

// ---- theme ----
export function loadTheme(): string | null {
  return get('theme')
}

export function saveTheme(id: string): void {
  set('theme', id)
}

// ---- data cache (offline fallback) ----
export function loadListsCache(): Lists {
  const raw = get('cache.lists')
  if (!raw) return EMPTY_LISTS
  try {
    const parsed = JSON.parse(raw)
    return {
      wantToWatch: parsed.wantToWatch ?? [],
      currentlyWatching: parsed.currentlyWatching ?? [],
      watched: parsed.watched ?? [],
    }
  } catch {
    return EMPTY_LISTS
  }
}

export function saveListsCache(lists: Lists): void {
  set('cache.lists', JSON.stringify(lists))
}

export function loadRatingsCache(): RatingsMap {
  const raw = get('cache.ratings')
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export function saveRatingsCache(ratings: RatingsMap): void {
  set('cache.ratings', JSON.stringify(ratings))
}

export function loadPlansCache(): PlansMap {
  const raw = get('cache.plans')
  if (!raw) return EMPTY_PLANS
  try {
    return JSON.parse(raw)
  } catch {
    return EMPTY_PLANS
  }
}

export function savePlansCache(plans: PlansMap): void {
  set('cache.plans', JSON.stringify(plans))
}

// ---- misc ----
export function loadString(key: string): string | null {
  return get(key)
}

export function saveString(key: string, value: string): void {
  set(key, value)
}