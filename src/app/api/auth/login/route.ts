import { NextResponse } from 'next/server'
import { getDb, isMongoConfigured } from '@/lib/mongodb'
import {
  roleForEmail,
  signToken,
  verifyPassword,
  type UserDoc,
} from '@/lib/auth-core'

export const dynamic = 'force-dynamic'

// Small in-memory brute-force guard (per email; resets after the window).
const MAX_ATTEMPTS = 10
const WINDOW_MS = 5 * 60 * 1000
const attempts = new Map<string, { count: number; resetAt: number }>()

function tooManyAttempts(email: string): boolean {
  const rec = attempts.get(email)
  if (!rec) return false
  if (Date.now() > rec.resetAt) {
    attempts.delete(email)
    return false
  }
  return rec.count >= MAX_ATTEMPTS
}

function recordFailure(email: string): void {
  const now = Date.now()
  const rec = attempts.get(email)
  if (!rec || now > rec.resetAt) {
    attempts.set(email, { count: 1, resetAt: now + WINDOW_MS })
  } else {
    rec.count += 1
  }
}

// POST /api/auth/login  body = { email, password }
export async function POST(req: Request) {
  if (!isMongoConfigured) {
    return NextResponse.json({ ok: false, error: 'Database is not configured.' }, { status: 503 })
  }
  let email = ''
  try {
    const body = (await req.json()) as { email?: string; password?: string }
    email = (body.email || '').trim().toLowerCase()
    const password = body.password || ''
    if (!email || !password) {
      return NextResponse.json({ ok: false, error: 'Enter email and password.' }, { status: 400 })
    }
    if (tooManyAttempts(email)) {
      return NextResponse.json(
        { ok: false, error: 'Too many attempts. Try again in a few minutes.' },
        { status: 429 },
      )
    }

    const db = await getDb()
    const user = await db.collection<UserDoc>('users').findOne({ email })
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      recordFailure(email)
      return NextResponse.json(
        { ok: false, error: 'Invalid credentials. If you have no account yet, sign up at /signup.' },
        { status: 401 },
      )
    }
    attempts.delete(email)

    const name = user.name || email.split('@')[0]
    const role = roleForEmail(email)
    const token = signToken({ sub: String(user._id), email, name, role })
    return NextResponse.json({
      ok: true,
      token,
      session: { email, name, role },
    })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
