import { NextResponse } from 'next/server'
import { getDb, isMongoConfigured } from '@/lib/mongodb'
import {
  newTokenVersion,
  roleForEmail,
  signToken,
  verifyPassword,
  type UserDoc,
} from '@/lib/auth-core'
import { clientAddress, serverErrorResponse, withSessionCookie } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

// In-memory brute-force guards, reset after the window: per e-mail address
// and per source address, so a password can't be guessed and e-mail
// addresses can't be cycled through from one place either.
const MAX_ATTEMPTS_PER_EMAIL = 10
const MAX_ATTEMPTS_PER_ADDRESS = 30
const WINDOW_MS = 5 * 60 * 1000
const MAX_PASSWORD_LENGTH = 200

type Bucket = { count: number; resetAt: number }
const byEmail = new Map<string, Bucket>()
const byAddress = new Map<string, Bucket>()

function blocked(map: Map<string, Bucket>, key: string, max: number): boolean {
  const rec = map.get(key)
  if (!rec) return false
  if (Date.now() > rec.resetAt) {
    map.delete(key)
    return false
  }
  return rec.count >= max
}

function recordFailure(map: Map<string, Bucket>, key: string): void {
  const now = Date.now()
  const rec = map.get(key)
  if (!rec || now > rec.resetAt) {
    if (map.size > 5000) {
      for (const [k, v] of map) if (now > v.resetAt) map.delete(k)
    }
    map.set(key, { count: 1, resetAt: now + WINDOW_MS })
  } else {
    rec.count += 1
  }
}

// POST /api/auth/login  body = { email, password }
export async function POST(req: Request) {
  if (!isMongoConfigured) {
    return NextResponse.json({ ok: false, error: 'Sign-in is temporarily unavailable.' }, { status: 503 })
  }
  const address = clientAddress(req)
  let email = ''
  try {
    let body: { email?: string; password?: string }
    try {
      body = (await req.json()) as { email?: string; password?: string }
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 })
    }
    email = String(body.email || '').trim().toLowerCase().slice(0, 200)
    const password = String(body.password || '')
    if (!email || !password) {
      return NextResponse.json({ ok: false, error: 'Enter email and password.' }, { status: 400 })
    }
    if (blocked(byEmail, email, MAX_ATTEMPTS_PER_EMAIL) || blocked(byAddress, address, MAX_ATTEMPTS_PER_ADDRESS)) {
      return NextResponse.json(
        { ok: false, error: 'Too many attempts. Try again in a few minutes.' },
        { status: 429 },
      )
    }

    const db = await getDb()
    const users = db.collection<UserDoc>('users')
    const user = await users.findOne({ email })
    const passwordOk =
      !!user && password.length <= MAX_PASSWORD_LENGTH && (await verifyPassword(password, user.passwordHash))
    if (!passwordOk) {
      recordFailure(byEmail, email)
      recordFailure(byAddress, address)
      return NextResponse.json(
        { ok: false, error: 'Invalid credentials. If you have no account yet, sign up at /signup.' },
        { status: 401 },
      )
    }
    byEmail.delete(email)

    const name = user.name || email.split('@')[0]
    const role = roleForEmail(email)
    // Accounts created before token versions existed get one on first sign-in.
    let tokenVersion = user.tokenVersion
    if (!tokenVersion) {
      tokenVersion = newTokenVersion()
      await users.updateOne({ _id: user._id }, { $set: { tokenVersion } })
    }
    const token = signToken({ sub: String(user._id), email, name, role, tv: tokenVersion })
    return withSessionCookie(
      NextResponse.json({ ok: true, session: { email, name, role } }),
      req,
      token,
    )
  } catch (e) {
    return serverErrorResponse(e, 'auth login')
  }
}
