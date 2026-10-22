// Admin-managed catalog. Source of truth is MongoDB Atlas (via `/api/products`,
// a single shared/global collection — products are not per-user). localStorage
// is an instant, offline-friendly cache. The admin panel writes the catalog;
// the storefront (home + /collection) reads it.

import { auth } from './firebase'
import { ADMIN_PRODUCTS_KEY, adminProductsSeed, type AdminProduct } from './catalog-data'

export { ADMIN_PRODUCTS_KEY, adminProductsSeed, type AdminProduct }

function cacheCatalog(list: AdminProduct[]): void {
  try { localStorage.setItem(ADMIN_PRODUCTS_KEY, JSON.stringify(list)) } catch { /* ignore */ }
}

// Synchronous cache reader (instant render). Falls back to the seed so the
// storefront always has something to show before the server responds.
export function loadAdminCatalog(): AdminProduct[] {
  if (typeof window === 'undefined') return adminProductsSeed
  try {
    const raw = localStorage.getItem(ADMIN_PRODUCTS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed
    }
  } catch { /* ignore */ }
  return adminProductsSeed
}

/**
 * Fetch the catalog from the server and refresh the cache. Falls back to the
 * cache (or seed) if the request fails.
 */
export async function fetchCatalog(): Promise<AdminProduct[]> {
  try {
    const res = await fetch('/api/products')
    const data = await res.json()
    if (!data.ok) return loadAdminCatalog()
    const products = (data.products ?? []) as AdminProduct[]
    cacheCatalog(products)
    return products
  } catch {
    return loadAdminCatalog()
  }
}

// Push the catalog to the server in the background (admin email is sent so the
// route can authorize the write).
async function pushCatalogToCloud(list: AdminProduct[]): Promise<void> {
  try {
    const email = auth.currentUser?.email?.toLowerCase() || ''
    await fetch('/api/products', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ products: list, email }),
    })
  } catch {
    /* offline — cache still holds it */
  }
}

/**
 * Persist the catalog (admin). Writes the cache synchronously and pushes to the
 * server in the background.
 */
export function saveCatalog(list: AdminProduct[]): void {
  cacheCatalog(list)
  void pushCatalogToCloud(list)
}
