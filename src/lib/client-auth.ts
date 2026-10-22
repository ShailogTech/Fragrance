// Client-side helper for calling the app's API routes with a Firebase ID
// token (verified server-side by src/lib/server-auth.ts).

import { auth } from './firebase'

export async function authHeaders(): Promise<Record<string, string>> {
  const base: Record<string, string> = { 'Content-Type': 'application/json' }
  const user = auth.currentUser
  if (!user) return base
  try {
    const token = await user.getIdToken()
    return { ...base, Authorization: `Bearer ${token}` }
  } catch {
    return base
  }
}

export function isSignedIn(): boolean {
  return Boolean(auth.currentUser)
}
