interface RepoInfo {
  owner: string
  repo: string
}

export function getRepo(): RepoInfo | null {
  const value = import.meta.env.VITE_GITHUB_REPO as string | undefined
  if (!value) return null
  const [owner, repo] = value.trim().split('/')
  if (!owner || !repo) return null
  return { owner, repo }
}

interface ContentsResponse {
  content?: string | null
  sha?: string
  encoding?: string
  name?: string
}

async function apiFetch(path: string, token: string | null, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(init.headers as Record<string, string> | undefined),
  }
  if (token) headers.Authorization = `Bearer ${token}`
  return fetch(`https://api.github.com${path}`, { ...init, headers })
}

function base64Encode(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function base64Decode(value: string): string {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}

/**
 * Reads a JSON file from the repo. First tries the raw.githubusercontent CDN
 * (works without a token for public repos), then the contents API (token needed).
 * Returns null when the file does not exist.
 */
export async function readJsonFile<T>(path: string, token?: string | null): Promise<T | null> {
  const repo = getRepo()
  if (!repo) return null

  // Try raw CDN first (public read, no token)
  const rawUrl = `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/HEAD/${path}`
  const rawRes = await fetch(rawUrl)
  if (rawRes.ok) {
    try {
      return (await rawRes.json()) as T
    } catch {
      return null
    }
  }

  // Fallback to the contents API (works for private repos when a token is stored)
  if (!token) return null
  const res = await apiFetch(`/repos/${repo.owner}/${repo.repo}/contents/${path}`, token)
  if (res.status === 404) return null
  if (!res.ok) return null
  const data = (await res.json()) as ContentsResponse
  if (!data.content || data.encoding !== 'base64') return null
  try {
    return JSON.parse(base64Decode(data.content)) as T
  } catch {
    return null
  }
}

/**
 * Writes a JSON object to the repo via the contents API. Requires a token with
 * "Contents: Read and Write" on the target repo. Uses authed reads to obtain the
 * current file sha for the update commit.
 */
export async function writeJsonFile(path: string, data: unknown, token: string, message?: string): Promise<boolean> {
  const repo = getRepo()
  if (!repo) return false

  const json = JSON.stringify(data, null, 2)
  const content = base64Encode(json)
  const commitMessage = message ?? `Update ${path}`

  // Fetch current sha (404 = file doesn't exist yet → create)
  let sha: string | undefined
  const readRes = await apiFetch(`/repos/${repo.owner}/${repo.repo}/contents/${path}`, token)
  if (readRes.ok) {
    const existing = (await readRes.json()) as ContentsResponse
    sha = existing.sha
  }

  const res = await apiFetch(`/repos/${repo.owner}/${repo.repo}/contents/${path}`, token, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: commitMessage,
      content,
      sha,
      branch: 'main',
    }),
  })

  if (!res.ok) {
    // Retry with the default branch name 'master' as a fallback
    const masterRes = await apiFetch(`/repos/${repo.owner}/${repo.repo}/contents/${path}`, token, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: commitMessage,
        content,
        sha,
        branch: 'master',
      }),
    })
    return masterRes.ok
  }
  return true
}