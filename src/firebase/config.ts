import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'
import { getAuth, type Auth } from 'firebase/auth'
import type { Firestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

export const firebaseEnabled = Boolean(firebaseConfig.apiKey && firebaseConfig.projectId)

let app: FirebaseApp | null = null
let db: Firestore | null = null
let auth: Auth | null = null

function ensureApp(): FirebaseApp | null {
  if (!firebaseEnabled) return null
  if (!app) {
    app = initializeApp(firebaseConfig)
    try {
      initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      })
    } catch {
      // Firestore already initialized (e.g. HMR) - safe to ignore.
    }
    db = getFirestore(app)
    auth = getAuth(app)
  }
  return app
}

export function getDb(): Firestore | null {
  ensureApp()
  return db
}

export function getAuthInstance(): Auth | null {
  ensureApp()
  return auth
}

// Each app "slot" maps to a fixed Firebase Auth account. The access key is that
// account's password; the app picks the email by hashing the key (same as the
// old check) and lets Firebase verify it. This avoids a Cloud Function (which
// would require the paid Blaze plan) while keeping the existing login UX.
export function slotEmail(index: number): string | null {
  if (!firebaseConfig.authDomain) return null
  return `slot${index}@${firebaseConfig.authDomain}`
}
