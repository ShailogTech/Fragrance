// Shared cart. Source of truth for a signed-in user is MongoDB Atlas (via the
// `/api/cart` route); localStorage is an instant, offline-friendly cache.
// saveCart() writes the cache synchronously and pushes to the server in the
// background, so every cart change syncs across devices. Framework-agnostic
// (no React), but only used client-side.

import { auth } from './firebase'

export const CART_KEY = 'shri:cart'

export interface CartLine {
  id: number
  name: string
  price: number
  image: string
  quantity: number
}

export function loadCart(): CartLine[] {
  try {
    const raw = localStorage.getItem(CART_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (i): i is CartLine =>
        i && typeof i.id === 'number' && typeof i.quantity === 'number',
    )
  } catch {
    return []
  }
}

// Push the cart to the server for the signed-in user (background, best-effort).
async function pushCartToCloud(items: CartLine[]): Promise<void> {
  try {
    const user = auth.currentUser
    if (!user) return
    await fetch('/api/cart', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ uid: user.uid, items }),
    })
  } catch {
    /* offline — cache still holds it */
  }
}

export function saveCart(items: CartLine[]): void {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items))
  } catch {
    /* storage unavailable */
  }
  void pushCartToCloud(items)
}

/**
 * Load the signed-in user's cart from the server and refresh the cache. If the
 * server is empty but the guest had a local cart, that cart is migrated up.
 * Falls back to the cache if there is no user or the request fails.
 */
export async function fetchCart(): Promise<CartLine[]> {
  const user = auth.currentUser
  if (!user) return loadCart()
  try {
    const res = await fetch(`/api/cart?uid=${encodeURIComponent(user.uid)}`)
    const data = await res.json()
    if (!data.ok) return loadCart()
    const items = (data.items ?? []) as CartLine[]
    if (items.length === 0) {
      // First sign-in: seed the server from whatever the guest had locally.
      const local = loadCart()
      if (local.length) {
        await pushCartToCloud(local)
        return local
      }
    }
    try { localStorage.setItem(CART_KEY, JSON.stringify(items)) } catch { /* ignore */ }
    return items
  } catch {
    return loadCart()
  }
}

// Pure helper: returns a new array with the line added/merged by id.
export function addLine(items: CartLine[], line: CartLine): CartLine[] {
  const existing = items.find(i => i.id === line.id)
  if (existing) {
    return items.map(i =>
      i.id === line.id ? { ...i, quantity: i.quantity + line.quantity } : i,
    )
  }
  return [...items, line]
}

// Add to the persisted cart directly (used from pages without cart state,
// e.g. dashboard reorder / move-to-cart). Returns the updated cart.
export function addToStoredCart(lines: CartLine[]): CartLine[] {
  let cart = loadCart()
  for (const line of lines) cart = addLine(cart, line)
  saveCart(cart)
  return cart
}
