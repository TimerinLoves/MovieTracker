const enc = new TextEncoder()
const dec = new TextDecoder()

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function base64ToBytes(base64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(input))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** For synchronous auth checks (auth-config stores sha256 hex). */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  return (await sha256Hex(password)) === storedHash.toLowerCase()
}

const ITERATIONS = 120000

async function deriveKey(password: string, salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** Encrypts data with a password. Output format: salt:iv:ciphertext (all base64). */
export async function encryptWithPassword(data: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(password, salt)
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(data))
  return `${bytesToBase64(salt)}:${bytesToBase64(iv)}:${bytesToBase64(new Uint8Array(cipher))}`
}

/** Decrypts previously encrypted data. Returns null on any failure (e.g. wrong password). */
export async function decryptWithPassword(stored: string, password: string): Promise<string | null> {
  try {
    const [saltB64, ivB64, cipherB64] = stored.split(':')
    const salt = base64ToBytes(saltB64)
    const iv = base64ToBytes(ivB64)
    const cipher = base64ToBytes(cipherB64)
    const key = await deriveKey(password, salt)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher)
    return dec.decode(plain)
  } catch {
    return null
  }
}

export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  return bytesToBase64(bytes)
}