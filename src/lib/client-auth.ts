// Client-side helper for calling the app's API routes.
//
// Since the own-auth upgrade the credential is an httpOnly `shri_session`
// cookie set by /api/auth/login|signup — fetch() sends it automatically for
// same-origin requests, so authHeaders() only needs Content-Type. The legacy
// localStorage token (sessions created before the cookie upgrade) is attached
// as a Bearer header when present, until the user signs in again.

import { getSession, TOKEN_KEY } from './auth'

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
  // Session-based: cookie sessions (the norm now) have no localStorage token.
  return Boolean(getSession() || getToken())
}
