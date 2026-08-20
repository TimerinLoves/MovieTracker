import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { AuthConfig, SessionData } from '../types'
import bundledAuthConfig from '../../auth-config.json'
import { decryptWithPassword, encryptWithPassword, sha256Hex } from '../utils/crypto'
import { readJsonFile } from '../utils/github'
import {
  clearSession,
  loadEncryptedGitHubToken,
  loadSession,
  saveEncryptedGitHubToken,
  saveSession,
} from '../utils/storage'

type AuthStatus = 'loading' | 'ready'

interface AuthContextValue {
  ready: boolean
  session: SessionData | null
  loggedIn: boolean
  tokenUnlocked: boolean
  sharedTokenReady: boolean
  userCount: number
  login: (key: string, displayName: string) => Promise<LoginResult>
  logout: () => void
  getGitHubToken: () => string | null
  saveGitHubToken: (token: string) => Promise<boolean>
  unlockGitHubToken: (key?: string) => Promise<boolean>
}

export type LoginResult = { ok: true; slotId: number; displayName: string } | { ok: false; error: string }

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState<AuthStatus>('loading')
  const [authConfig, setAuthConfig] = useState<AuthConfig>(bundledAuthConfig)
  const [session, setSession] = useState<SessionData | null>(() => loadSession())

  // In-memory only - never persisted. Cleared on refresh/logout.
  const passwordRef = useMemo(() => ({ current: null as string | null }), [])
  const [gitToken, setGitToken] = useState<string | null>(null)

  // Optional shared write token embedded at build time (GIT_PUSH_TOKEN). Used as a
  // fallback so any logged-in user can sync without pasting a token per browser.
  const buildToken = (import.meta.env.VITE_GITHUB_TOKEN as string | undefined)?.trim() || null

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const remote = await readJsonFile<AuthConfig>('auth-config.json')
      if (!cancelled) {
        if (remote && Array.isArray(remote.users)) setAuthConfig(remote)
        setReady('ready')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Try to unlock the stored GitHub token if the user is already logged in
  // (works when password is still in memory this session).
  useEffect(() => {
    if (!session || gitToken) return
    const stored = loadEncryptedGitHubToken(session.slotId)
    if (!stored || !passwordRef.current) return
    decryptWithPassword(stored, passwordRef.current).then((plain) => {
      if (plain) setGitToken(plain)
    })
  }, [session, gitToken, passwordRef])

  const login = useCallback(
    async (key: string, displayName: string): Promise<LoginResult> => {
      if (!key.trim()) return { ok: false, error: 'Enter your access key.' }
      if (!displayName.trim()) return { ok: false, error: 'Enter a display name.' }

      const hash = await sha256Hex(key.trim())
      const index = authConfig.users.findIndex((u) => u.passwordHash && u.passwordHash.toLowerCase() === hash)
      if (index < 0) return { ok: false, error: 'That access key is not recognized.' }

      passwordRef.current = key.trim()
      const newSession: SessionData = {
        slotId: index,
        displayName: displayName.trim(),
        loggedInAt: new Date().toISOString(),
      }
      setSession(newSession)
      saveSession(newSession)

      const stored = loadEncryptedGitHubToken(index)
      if (stored) {
        const plain = await decryptWithPassword(stored, key.trim())
        if (plain) setGitToken(plain)
      }
      return { ok: true, slotId: index, displayName: newSession.displayName }
    },
    [authConfig, passwordRef],
  )

  const logout = useCallback(() => {
    passwordRef.current = null
    setGitToken(null)
    setSession(null)
    clearSession()
  }, [passwordRef])

  const saveGitHubToken = useCallback(
    async (token: string): Promise<boolean> => {
      if (!session) return false
      const password = passwordRef.current
      if (!password) return false
      const encrypted = await encryptWithPassword(token.trim(), password)
      saveEncryptedGitHubToken(session.slotId, encrypted)
      setGitToken(token.trim())
      return true
    },
    [session, passwordRef],
  )

  const unlockGitHubToken = useCallback(
    async (key?: string): Promise<boolean> => {
      if (!session) return false
      const password = key?.trim() || passwordRef.current
      if (!password) return false
      const stored = loadEncryptedGitHubToken(session.slotId)
      if (!stored) return false
      const plain = await decryptWithPassword(stored, password)
      if (!plain) return false
      passwordRef.current = password
      setGitToken(plain)
      return true
    },
    [session, passwordRef],
  )

  const getGitHubToken = useCallback(() => {
    // Per-user stored token wins; otherwise fall back to the shared build token
    // so any logged-in user can sync without storing a token on this device.
    return gitToken ?? (buildToken && session ? buildToken : null)
  }, [gitToken, buildToken, session])

  const value = useMemo<AuthContextValue>(
    () => ({
      ready: ready === 'ready',
      session,
      loggedIn: session !== null,
      tokenUnlocked: getGitHubToken() !== null,
      sharedTokenReady: buildToken !== null,
      userCount: authConfig.users.length || 2,
      login,
      logout,
      getGitHubToken,
      saveGitHubToken,
      unlockGitHubToken,
    }),
    [ready, session, buildToken, authConfig, login, logout, getGitHubToken, saveGitHubToken, unlockGitHubToken],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}

/** Maps slotId → display name for rating attribution. */
export function slotLabel(slotId: number, session: SessionData | null, fallback = 'User'): string {
  if (session && session.slotId === slotId) return session.displayName
  return slotId === 0 ? 'User A' : slotId === 1 ? 'User B' : `${fallback} ${slotId + 1}`
}