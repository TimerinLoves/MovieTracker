import admin from 'firebase-admin'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const projectId = process.env.FIREBASE_PROJECT_ID
if (!projectId) {
  console.error('Set FIREBASE_PROJECT_ID to your Firebase project id before running.')
  process.exit(1)
}

if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  admin.initializeApp({
    credential: admin.credential.cert(process.env.GOOGLE_APPLICATION_CREDENTIALS),
    projectId,
  })
} else {
  admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId })
}

const db = admin.firestore()

async function migrateFolder(folder, collectionName) {
  const dir = path.join(root, 'data', folder)
  if (!fs.existsSync(dir)) {
    console.log(`Skip ${folder} (no local folder)`)
    return
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
  for (const f of files) {
    const key = f.replace(/\.json$/, '')
    const data = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
    await db.collection(collectionName).doc(key).set(data)
    console.log('wrote', collectionName, key)
  }
}

await migrateFolder('lists', 'lists')
await migrateFolder('ratings', 'ratings')
await migrateFolder('plans', 'plans')
console.log('Migration complete.')
process.exit(0)
