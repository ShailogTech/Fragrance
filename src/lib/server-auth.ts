// Server-side authentication for API route handlers.
//
// The app authenticates against its own /api/auth/* routes (local MongoDB +
// scrypt + HS256 session tokens — see src/lib/auth-core.ts). Clients send the
// token as `Authorization: Bearer <token>`; it is verified here with a local
// HMAC check, so routes never trust a client-supplied uid/email and no
// external auth service is contacted.
//
// Server-only — never import from a client component.

import { NextResponse } from 'next/server'
import { verifyToken, ADMIN_EMAILS } from './auth-core'

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
 * Verify the request's session token. Returns null when the request carries
 * no token; throws a Response-producing Error for invalid tokens.
 */
export async function requireUser(req: Request): Promise<VerifiedUser | null> {
  const token = bearerToken(req)
  if (!token) return null

  const claims = verifyToken(token)
  if (!claims) {
    throw new AuthError(401, 'Invalid or expired session. Please sign in again.')
  }
  const email = claims.email.toLowerCase()
  return { uid: claims.sub, email, isAdmin: ADMIN_EMAILS.has(email) || claims.role === 'admin' }
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
