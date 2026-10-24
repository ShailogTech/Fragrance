// Client-side helper for calling the app's API routes with the own-auth
// session token (verified server-side by src/lib/server-auth.ts).

import { TOKEN_KEY } from './auth'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

// Drop-in replacement for Firebase's `auth.currentUser.getIdToken()`.
export async function getIdToken(): Promise<string | null> {
  return getToken()
}

export async function authHeaders(): Promise<Record<string, string>> {
  const base: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getToken()
  return token ? { ...base, Authorization: `Bearer ${token}` } : base
}

export function isSignedIn(): boolean {
  return Boolean(getToken())
}
