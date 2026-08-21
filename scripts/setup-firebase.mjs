import admin from 'firebase-admin'
import { spawnSync } from 'node:child_process'

const projectId = process.env.FIREBASE_PROJECT_ID || 'sweetscreen-p'
const key0 = process.env.KEY0
const key1 = process.env.KEY1

if (!key0 || !key1) {
  console.error('Usage: KEY0=<access key 0> KEY1=<access key 1> node scripts/setup-firebase.mjs')
  console.error('The keys are your two current access keys (the passwords). They must be at least 6 characters.')
  process.exit(1)
}

if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  admin.initializeApp({ credential: admin.credential.cert(process.env.GOOGLE_APPLICATION_CREDENTIALS), projectId })
} else {
  admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId })
}

const authDomain = `${projectId}.firebaseapp.com`
const users = [
  { email: `slot0@${authDomain}`, password: key0 },
  { email: `slot1@${authDomain}`, password: key1 },
]

async function run() {
  // 1. Create the two Firebase Auth accounts (passwords = the access keys).
  for (const u of users) {
    try {
      await admin.auth().createUser(u)
      console.log(`created auth user ${u.email}`)
    } catch (e) {
      if (e.code === 'auth/email-already-exists') console.log(`${u.email} already exists - skipping`)
      else {
        console.error(`failed to create ${u.email}:`, e.message)
        console.error('Firebase Auth requires passwords of at least 6 characters. If a key is shorter, it cannot be used.')
      }
    }
  }

  // 2. Best-effort: enable the Email/Password sign-in provider via the
  // Identity Toolkit API. If this fails, enable it manually in the console
  // (Authentication -> Sign-in method -> Email/Password).
  try {
    const token = spawnSync('gcloud', ['auth', 'application-default', 'print-access-token'], {
      encoding: 'utf8',
      shell: true,
    }).stdout.trim()
    if (token) {
      const res = await fetch(`https://identitytoolkit.googleapis.com/v2/projects/${projectId}/config?updateMask=signIn.email.enabled`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ signIn: { email: { enabled: true } } }),
      })
      console.log('enable Email/Password provider:', res.ok ? 'ok' : `failed (${res.status}) - enable manually in console`)
    }
  } catch {
    console.log('could not enable Email/Password automatically - enable it manually in the console')
  }

  // 3. Create the Firestore database (Native mode) if it does not exist yet.
  const db = spawnSync('firebase', ['firestore:databases:create', '--location=us-central1'], {
    stdio: 'inherit',
    shell: true,
  })
  console.log('firestore db create exit:', db.status ?? 'n/a')

  // 4. Deploy the security rules.
  const deploy = spawnSync('firebase', ['deploy', '--only', 'firestore:rules'], { stdio: 'inherit', shell: true })
  console.log('rules deploy exit:', deploy.status ?? 'n/a')

  // 5. Migrate the existing git data into Firestore.
  const migrate = spawnSync('node', ['scripts/migrate-to-firestore.mjs'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, FIREBASE_PROJECT_ID: projectId },
  })
  console.log('migration exit:', migrate.status ?? 'n/a')

  console.log('\nSetup complete. If the Email/Password provider step failed, enable it in the Firebase console, then tell the assistant to commit and deploy.')
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
