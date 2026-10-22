// Orders backend.
//
// Source of truth is MongoDB Atlas, reached through the `/api/orders` route
// handlers (server-side). localStorage is kept as an instant, offline-friendly
// cache so the UI renders immediately and keeps working if the API is down.
// Writes go to both: the cache is updated synchronously and the server write
// is fired in the background.

import type { CartLine } from './cart'
import { auth } from './firebase'

export const ORDERS_KEY = 'shri:orders'

export interface CustomerDetails {
  name: string
  email: string
  phone: string
}

export interface ShipmentDetails {
  address: string
  city: string
  state: string
  pincode: string
  notes?: string
  method?: string // 'standard' | 'express'
}

export interface StoredOrder {
  id: string
  date: string
  items: CartLine[]
  total: number
  status: string
  customer?: CustomerDetails
  shipment?: ShipmentDetails
  // Backend metadata.
  uid?: string
  userEmail?: string
  createdAt?: number // epoch ms, for stable ordering
}

// ---- localStorage cache (instant + offline fallback) ----

export function loadOrders(): StoredOrder[] {
  try {
    const raw = localStorage.getItem(ORDERS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveOrders(orders: StoredOrder[]): void {
  try {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders))
  } catch {
    /* storage unavailable */
  }
}

function sortByNewest(orders: StoredOrder[]): StoredOrder[] {
  return [...orders].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
}

// ---- server (MongoDB via /api/orders) ----

async function persistToCloud(order: StoredOrder): Promise<void> {
  try {
    await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(order),
    })
  } catch {
    /* offline — cache still holds it */
  }
}

async function updateCloudStatus(id: string, status: string): Promise<void> {
  try {
    await fetch(`/api/orders/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
  } catch {
    /* offline — cache still holds it */
  }
}

/**
 * Fetch the signed-in user's orders from the server and refresh the local
 * cache. Falls back to the cache if there is no user or the request fails.
 */
export async function fetchMyOrders(): Promise<StoredOrder[]> {
  const user = auth.currentUser
  if (!user) return sortByNewest(loadOrders())
  try {
    const res = await fetch(`/api/orders?uid=${encodeURIComponent(user.uid)}`)
    const data = await res.json()
    if (!data.ok) return sortByNewest(loadOrders())
    const ordered = sortByNewest(data.orders as StoredOrder[])
    saveOrders(ordered) // refresh cache with the source of truth
    return ordered
  } catch {
    return sortByNewest(loadOrders())
  }
}

/**
 * Fetch every order (admin view). Does not touch the per-user cache.
 */
export async function fetchAllOrders(): Promise<StoredOrder[]> {
  const email = auth.currentUser?.email?.toLowerCase() || ''
  try {
    const res = await fetch(`/api/orders?all=1&email=${encodeURIComponent(email)}`)
    const data = await res.json()
    if (!data.ok) return sortByNewest(loadOrders())
    return sortByNewest(data.orders as StoredOrder[])
  } catch {
    return sortByNewest(loadOrders())
  }
}

// ---- mutations (cache now, server in background) ----

export function cancelStoredOrder(id: string): StoredOrder | null {
  const orders = loadOrders()
  const idx = orders.findIndex(o => o.id === id)
  if (idx === -1) return null
  if (orders[idx].status !== 'Processing') return null
  orders[idx] = { ...orders[idx], status: 'Cancelled' }
  saveOrders(orders)
  void updateCloudStatus(id, 'Cancelled')
  return orders[idx]
}

/**
 * Update an order's status (admin). Updates the cache and the server, and
 * returns the new full list from cache.
 */
export function setOrderStatus(id: string, status: string): StoredOrder[] {
  const next = loadOrders().map(o => (o.id === id ? { ...o, status } : o))
  saveOrders(next)
  void updateCloudStatus(id, status)
  return next
}

export function addOrder(
  items: CartLine[],
  total: number,
  details?: { customer?: CustomerDetails; shipment?: ShipmentDetails },
): StoredOrder {
  const user = auth.currentUser
  const order: StoredOrder = {
    id: 'ORD-' + Date.now().toString(36).toUpperCase(),
    date: new Date().toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
    items,
    total,
    status: 'Processing',
    customer: details?.customer,
    shipment: details?.shipment,
    uid: user?.uid,
    userEmail: user?.email?.toLowerCase() || details?.customer?.email?.toLowerCase(),
    createdAt: Date.now(),
  }
  saveOrders([order, ...loadOrders()])
  void persistToCloud(order)
  return order
}
