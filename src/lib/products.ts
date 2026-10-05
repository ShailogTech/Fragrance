// Serverless product store.
//
// The single source of truth is `public/products.json` in this repository.
//
//  - The landing page bakes a copy of the file into the static bundle at
//    build time (the import below), so the site always renders instantly —
//    then refreshes from raw.githubusercontent.com at runtime so admin edits
//    appear without redeploying.
//  - The admin page (/admin) loads and saves the same file through the
//    GitHub Contents API using a fine-grained personal access token that
//    lives only in the admin's browser. No server, no database.
//
// Both endpoints used here (api.github.com and raw.githubusercontent.com)
// send `Access-Control-Allow-Origin: *`, so everything works from a plain
// static host.

import baked from '../../public/products.json'

export interface Product {
  id: number
  name: string
  category: string
  price: number // rupees
  image: string // "/images/..." or any https URL
  description: string
}

interface ProductsFile {
  products: Product[]
}

// Repository defaults — change here, or per-browser in the admin page.
export const DEFAULT_GH = {
  owner: 'ShailogTech',
  repo: 'Fragrance',
  branch: 'main',
} as const

export const FILE_PATH = 'public/products.json'

export function sortProducts(list: Product[]): Product[] {
  return [...list].sort((a, b) => a.id - b.id)
}

export function nextProductId(list: Product[]): number {
  return list.reduce((max, p) => Math.max(max, p.id), 0) + 1
}

/** Copy bundled at build time — instant, offline-safe render. */
export function bakedProducts(): Product[] {
  const file = baked as ProductsFile
  return Array.isArray(file.products) ? file.products : []
}

function parseProductsFile(text: string): Product[] | null {
  try {
    const data = JSON.parse(text) as ProductsFile
    if (!Array.isArray(data.products)) return null
    return data.products.filter(
      (p) => p && typeof p.id === 'number' && typeof p.name === 'string',
    )
  } catch {
    return null
  }
}

export function serializeProducts(list: Product[]): string {
  const file: ProductsFile = { products: sortProducts(list) }
  return `${JSON.stringify(file, null, 2)}\n`
}

// ---------------------------------------------------------------------------
// Public read: raw.githubusercontent.com (no token, CORS-enabled). The query
// param works around the raw CDN's short cache so edits show up quickly.
// ---------------------------------------------------------------------------

export interface RepoRef {
  owner: string
  repo: string
  branch: string
}

export function rawProductsUrl(ref: RepoRef): string {
  return `https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/${ref.branch}/${FILE_PATH}`
}

/** Live catalog from the repo; null when unreachable (site falls back to the baked copy). */
export async function fetchLiveProducts(ref: RepoRef): Promise<Product[] | null> {
  try {
    const res = await fetch(`${rawProductsUrl(ref)}?t=${Date.now()}`, {
      cache: 'no-store',
    })
    if (!res.ok) return null
    const products = parseProductsFile(await res.text())
    return products ? sortProducts(products) : null
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Admin write: GitHub Contents API. Needs a fine-grained PAT with
// "Contents: Read and write" on this repository.
// ---------------------------------------------------------------------------

export interface GhConfig extends RepoRef {
  token: string
}

export class GhError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

function ghHeaders(cfg: GhConfig): HeadersInit {
  return {
    Authorization: `Bearer ${cfg.token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'Content-Type': 'application/json',
  }
}

function contentsUrl(cfg: GhConfig): string {
  return `https://api.github.com/repos/${cfg.owner}/${cfg.repo}/contents/${FILE_PATH}`
}

// base64 helpers that tolerate non-ASCII (descriptions should stay ASCII, but
// never rely on that).
function toBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function fromBase64(b64: string): string {
  const binary = atob(b64.replace(/\s/g, ''))
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export interface LoadedFile {
  products: Product[]
  sha: string | null // null → file doesn't exist yet, first save creates it
}

/** Load products.json (with its blob SHA, needed for updates). */
export async function ghLoadProducts(cfg: GhConfig): Promise<LoadedFile> {
  const res = await fetch(`${contentsUrl(cfg)}?ref=${encodeURIComponent(cfg.branch)}`, {
    headers: ghHeaders(cfg),
    cache: 'no-store',
  })
  if (res.status === 404) {
    // Not created yet — start from the baked copy; the first save creates it.
    return { products: bakedProducts(), sha: null }
  }
  if (res.status === 401) {
    throw new GhError(401, 'Invalid or expired token. Generate a new one and reconnect.')
  }
  if (res.status === 403) {
    throw new GhError(403, 'Token does not have access to this repository (check its permissions and SSO).')
  }
  if (!res.ok) {
    throw new GhError(res.status, `GitHub API error ${res.status}`)
  }
  const data = (await res.json()) as { sha: string; content: string; encoding: string }
  if (data.encoding && data.encoding !== 'base64') {
    throw new GhError(0, `Unexpected encoding "${data.encoding}" from GitHub.`)
  }
  const products = parseProductsFile(fromBase64(data.content))
  if (!products) throw new GhError(0, 'products.json in the repo is malformed.')
  return { products: sortProducts(products), sha: data.sha }
}

export interface SaveResult {
  sha: string
  commitUrl: string | null
}

/** Commit an updated products list. Throws GhError(409) on a stale SHA. */
export async function ghSaveProducts(
  cfg: GhConfig,
  products: Product[],
  sha: string | null,
): Promise<SaveResult> {
  const res = await fetch(contentsUrl(cfg), {
    method: 'PUT',
    headers: ghHeaders(cfg),
    body: JSON.stringify({
      message: `chore(catalog): update products [via admin]`,
      content: toBase64(serializeProducts(products)),
      ...(sha ? { sha } : {}),
      branch: cfg.branch,
    }),
  })
  if (res.status === 401) {
    throw new GhError(401, 'Invalid or expired token. Generate a new one and reconnect.')
  }
  if (res.status === 403) {
    throw new GhError(403, 'Token cannot write to this repository (needs "Contents: Read and write").')
  }
  if (res.status === 409) {
    throw new GhError(409, 'The file changed on GitHub while you were editing. Retrying with the latest copy…')
  }
  if (!res.ok) {
    let detail = `GitHub API error ${res.status}`
    try {
      const body = (await res.json()) as { message?: string }
      if (body.message) detail = `${detail} — ${body.message}`
    } catch { /* keep default */ }
    throw new GhError(res.status, detail)
  }
  const data = (await res.json()) as {
    content: { sha: string }
    commit?: { html_url?: string }
  }
  return { sha: data.content.sha, commitUrl: data.commit?.html_url ?? null }
}
