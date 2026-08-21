interface RepoInfo {
  owner: string
  repo: string
}

let repoInfoCache: RepoInfo | null | undefined
let defaultBranchCache: string | null | undefined

export function getRepo(): RepoInfo | null {
  if (repoInfoCache !== undefined) return repoInfoCache
  const value = import.meta.env.VITE_GITHUB_REPO as string | undefined
  if (!value) {
    repoInfoCache = null
    return null
  }
  const [owner, repo] = value.trim().split('/')
  if (!owner || !repo) {
    repoInfoCache = null
    return null
  }
  repoInfoCache = { owner, repo }
  return repoInfoCache
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
  return fetch(`https://api.github.com${path}`, { ...init, headers, cache: 'no-store' })
}

/**
 * Resolves the repo's default branch once and caches it, so writes always
 * target the real branch instead of guessing "main" or "master".
 */
export async function resolveDefaultBranch(token: string | null): Promise<string | null> {
  if (defaultBranchCache !== undefined) return defaultBranchCache
  const repo = getRepo()
  if (!repo) return null
  try {
    const res = await apiFetch(`/repos/${repo.owner}/${repo.repo}`, token)
    if (res.ok) {
      const meta = (await res.json()) as { default_branch?: string }
      defaultBranchCache = meta.default_branch ?? 'main'
    } else {
      defaultBranchCache = 'main'
    }
  } catch {
    defaultBranchCache = 'main'
  }
  return defaultBranchCache
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
 * Reads a JSON file from the repo. Uses the contents API - fresh data with no
 * CDN delay, and it works without a token on public repos - then falls back to
 * the raw.githubusercontent CDN only as a last resort. Returns null when the
 * file does not exist.
 */
export async function readJsonFile<T>(path: string, token?: string | null): Promise<T | null> {
  const repo = getRepo()
  if (!repo) return null

  try {
    const res = await apiFetch(`/repos/${repo.owner}/${repo.repo}/contents/${path}`, token ?? null)
    if (res.status === 404) return null
    if (res.ok) {
      const data = (await res.json()) as ContentsResponse
      if (data.content && data.encoding === 'base64') {
        try {
          return JSON.parse(base64Decode(data.content)) as T
        } catch {
          return null
        }
      }
    }
  } catch {
    // fall through to the raw CDN
  }

  // Public read fallback. No-store to avoid the browser serving a stale copy.
  const rawUrl = `https://raw.githubusercontent.com/${repo.owner}/${repo.repo}/HEAD/${path}`
  const rawRes = await fetch(rawUrl, { cache: 'no-store' })
  if (rawRes.ok) {
    try {
      return (await rawRes.json()) as T
    } catch {
      return null
    }
  }
  return null
}

/** Core PUT that creates or updates a file, retrying on the 409 conflict. */
async function putContents(path: string, data: unknown, token: string, message?: string): Promise<boolean> {
  const repo = getRepo()
  if (!repo) return false

  const json = JSON.stringify(data, null, 2)
  const content = base64Encode(json)
  const commitMessage = message ?? `Update ${path}`
  const branch = (await resolveDefaultBranch(token)) ?? 'main'
  const url = `/repos/${repo.owner}/${repo.repo}/contents/${path}`

  for (let attempt = 0; attempt < 3; attempt++) {
    let sha: string | undefined
    const readRes = await apiFetch(url, token)
    if (readRes.ok) {
      const existing = (await readRes.json()) as ContentsResponse
      sha = existing.sha
    }

    const res = await apiFetch(url, token, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: commitMessage,
        content,
        sha,
        branch,
      }),
    })

    if (res.ok) return true
    // 409 = file changed since we read the sha - refresh and try again
    if (res.status === 409) continue
    return false
  }
  return false
}

/**
 * Writes a JSON object to the repo via the contents API. Requires a token with
 * "Contents: Read and Write" on the target repo. Refetches the file sha and
 * retries on the normal concurrent-edit conflict (409) instead of dropping
 * the update.
 */
export async function writeJsonFile(path: string, data: unknown, token: string, message?: string): Promise<boolean> {
  const repo = getRepo()
  if (!repo) return false
  return putContents(path, data, token, message)
}

/** Deletes a file from the repo. Safe to call when it may not exist. */
export async function deleteRepoFile(folder: string, key: string, token: string, message?: string): Promise<boolean> {
  const repo = getRepo()
  if (!repo) return false

  const path = `data/${folder}/${key}.json`
  const branch = (await resolveDefaultBranch(token)) ?? 'main'
  const url = `/repos/${repo.owner}/${repo.repo}/contents/${path}`

  let sha: string | undefined
  const readRes = await apiFetch(url, token)
  if (readRes.status === 404) return true // already gone
  if (readRes.ok) {
    const existing = (await readRes.json()) as ContentsResponse
    sha = existing.sha
  }

  const res = await apiFetch(url, token, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: message ?? `Delete ${path}`, sha, branch }),
  })
  return res.ok || res.status === 404
}

/** Lists the .json files inside a data subfolder (returns name without extension + path + sha). */
export async function listFolder(
  folder: string,
  token?: string | null,
): Promise<{ name: string; path: string; sha: string }[]> {
  const repo = getRepo()
  if (!repo) return []
  const res = await apiFetch(`/repos/${repo.owner}/${repo.repo}/contents/data/${folder}`, token ?? null)
  if (res.status === 404) return []
  if (!res.ok) return []
  const entries = (await res.json()) as { name: string; path: string; sha: string; type: string }[]
  return entries
    .filter((e) => e.type === 'file' && e.name.endsWith('.json') && e.name !== 'index.json')
    .map((e) => ({ name: e.name.replace(/\.json$/, ''), path: e.path, sha: e.sha }))
}

/**
 * Reads a whole data subfolder into a keyed map. Each file is
 * `data/<folder>/<key>.json`. Returns an empty map when the folder is absent.
 * All file contents are fetched in parallel.
 */
export async function readFolder<T>(folder: string, token?: string | null): Promise<Record<string, T>> {
  const repo = getRepo()
  if (!repo) return {}
  const entries = await listFolder(folder, token)
  const out: Record<string, T> = {}
  await Promise.all(
    entries.map(async (e) => {
      const res = await apiFetch(`/repos/${repo.owner}/${repo.repo}/contents/${e.path}`, token ?? null)
      if (!res.ok) return
      const data = (await res.json()) as ContentsResponse
      if (!data.content || data.encoding !== 'base64') return
      try {
        out[e.name] = JSON.parse(base64Decode(data.content)) as T
      } catch {
        // skip malformed file
      }
    }),
  )
  return out
}

/** Writes a single entry file: `data/<folder>/<key>.json`. */
export async function writeRepoFile(
  folder: string,
  key: string,
  data: unknown,
  token: string,
  message?: string,
): Promise<boolean> {
  const repo = getRepo()
  if (!repo) return false
  return putContents(`data/${folder}/${key}.json`, data, token, message)
}
