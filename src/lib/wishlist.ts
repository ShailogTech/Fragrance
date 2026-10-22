// Wishlist backend.
//
// Same model as orders.ts: MongoDB Atlas (via the `/api/wishlist` route) is
// the source of truth for a signed-in user, with localStorage as an instant,
// offline-friendly cache. Guests get a local-only wishlist that is migrated up
// to the server the first time they sign in.

import { auth } from './firebase'

export const WISHLIST_KEY = 'shri:wishlist'

export interface WishEntry {
  id: number
  name: string
  price: number
  originalPrice: number
  image: string
  inStock?: boolean
}

// ---- localStorage cache (instant + offline / guest fallback) ----

export function loadWishlist(): WishEntry[] {
  try {
    const raw = localStorage.getItem(WISHLIST_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((i): i is WishEntry => i && typeof i.id === 'number') : []
  } catch {
    return []
  }
}

export function saveWishlist(items: WishEntry[]): void {
  try {
    localStorage.setItem(WISHLIST_KEY, JSON.stringify(items))
  } catch {
    /* storage unavailable */
  }
}

// ---- server (MongoDB via /api/wishlist) ----

async function persistToCloud(items: WishEntry[]): Promise<void> {
  try {
    const user = auth.currentUser
    if (!user) return
    await fetch('/api/wishlist', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: user.uid, items }),
    })
  } catch {
    /* offline — cache still holds it */
  }
}

/**
 * Load the signed-in user's wishlist from the server and refresh the cache.
 * If the server is empty but the guest had local items, those are migrated up.
 * Falls back to the cache if there is no user or the request fails.
 */
export async function fetchWishlist(): Promise<WishEntry[]> {
  const user = auth.currentUser
  if (!user) return loadWishlist()
  try {
    const res = await fetch(`/api/wishlist?uid=${encodeURIComponent(user.uid)}`)
    const data = await res.json()
    if (!data.ok) return loadWishlist()
    const items = (data.items ?? []) as WishEntry[]
    if (items.length === 0) {
      // First sign-in: seed the server from whatever the guest had locally.
      const local = loadWishlist()
      if (local.length) {
        await persistToCloud(local)
        return local
      }
    }
    saveWishlist(items)
    return items
  } catch {
    return loadWishlist()
  }
}

// ---- mutations (cache now, server in background) ----

/** Toggle an item by id. Returns the new full list. */
export function toggleWishlist(entry: WishEntry): WishEntry[] {
  const current = loadWishlist()
  const exists = current.some(i => i.id === entry.id)
  const next = exists ? current.filter(i => i.id !== entry.id) : [...current, entry]
  saveWishlist(next)
  void persistToCloud(next)
  return next
}

/** Remove an item by id. Returns the new full list. */
export function removeFromWishlist(id: number): WishEntry[] {
  const next = loadWishlist().filter(i => i.id !== id)
  saveWishlist(next)
  void persistToCloud(next)
  return next
}

export function isWished(id: number): boolean {
  return loadWishlist().some(i => i.id === id)
}
