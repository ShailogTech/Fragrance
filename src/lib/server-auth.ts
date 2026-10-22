// Server-side authentication for API route handlers.
//
// The app authenticates users with Firebase Authentication in the browser.
// Firebase ID tokens (1-hour JWTs, via `auth.currentUser.getIdToken()`) are
// sent as `Authorization: Bearer <token>` and verified here against
// Firebase's REST API, so routes never trust a client-supplied uid/email.
//
// Server-only — never import from a client component.

import { NextResponse } from 'next/server'

// The web API key is part of the public Firebase client config (see
// src/lib/firebase.ts); it identifies the project, it is not a secret.
// FIREBASE_API_KEY may override it for separate environments.
const WEB_API_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyAD2QUIcv7v1Bsa8yRQTsauoFA9vq9dTWs'

const ADMIN_EMAILS = new Set(['admin@shrifragrance.com'])

export interface VerifiedUser {
  uid: string
  email: string
  isAdmin: boolean
}

function bearerToken(req: Request): string | null {
  const header = req.headers.get('authorization') || ''
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match ? match[1].trim() : null
}

/**
 * Verify the request's Firebase ID token. Returns null when the request
 * carries no token; throws a Response-producing Error for invalid tokens.
 */
export async function requireUser(req: Request): Promise<VerifiedUser | null> {
  const token = bearerToken(req)
  if (!token) return null

  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${WEB_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken: token }),
      cache: 'no-store',
    },
  )
  if (!res.ok) {
    throw new AuthError(401, 'Invalid or expired session. Please sign in again.')
  }
  const data = (await res.json()) as {
    users?: Array<{ localId: string; email?: string }>
  }
  const user = data.users?.[0]
  if (!user?.localId) {
    throw new AuthError(401, 'Invalid or expired session. Please sign in again.')
  }
  const email = (user.email || '').toLowerCase()
  return { uid: user.localId, email, isAdmin: ADMIN_EMAILS.has(email) }
}

/** Like requireUser, but responds 401 when no token is present. */
export async function requireUserStrict(req: Request): Promise<VerifiedUser> {
  const user = await requireUser(req)
  if (!user) throw new AuthError(401, 'Sign-in required.')
  return user
}

/** Like requireUserStrict, but also enforces the admin allowlist. */
export async function requireAdmin(req: Request): Promise<VerifiedUser> {
  const user = await requireUserStrict(req)
  if (!user.isAdmin) throw new AuthError(403, 'Admin access only.')
  return user
}

export class AuthError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

/** Convert an AuthError (or any error) into a JSON response. */
export function authErrorResponse(e: unknown): NextResponse {
  if (e instanceof AuthError) {
    return NextResponse.json({ ok: false, error: e.message }, { status: e.status })
  }
  return NextResponse.json(
    { ok: false, error: e instanceof Error ? e.message : 'Unauthorized.' },
    { status: 401 },
  )
}
