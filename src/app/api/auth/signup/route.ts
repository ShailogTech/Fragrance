import { NextResponse } from 'next/server'
import { getDb, isMongoConfigured } from '@/lib/mongodb'
import { hashPassword, passwordPolicyError, roleForEmail, signToken, type UserDoc } from '@/lib/auth-core'
import { withSessionCookie } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

// Small in-memory throttle (per email; resets after the window) so signup
// can't be used to mass-create accounts or probe for existing ones.
const MAX_SIGNUPS = 5
const WINDOW_MS = 60 * 60 * 1000
const attempts = new Map<string, { count: number; resetAt: number }>()

function throttled(email: string): boolean {
  const rec = attempts.get(email)
  if (!rec) return false
  if (Date.now() > rec.resetAt) {
    attempts.delete(email)
    return false
  }
  return rec.count >= MAX_SIGNUPS
}

function record(email: string): void {
  const now = Date.now()
  const rec = attempts.get(email)
  if (!rec || now > rec.resetAt) attempts.set(email, { count: 1, resetAt: now + WINDOW_MS })
  else rec.count += 1
}

// POST /api/auth/signup  body = { email, name, password, phone? }
export async function POST(req: Request) {
  if (!isMongoConfigured) {
    return NextResponse.json({ ok: false, error: 'Database is not configured.' }, { status: 503 })
  }
  try {
    const body = (await req.json()) as {
      email?: string
      name?: string
      password?: string
      phone?: string
    }
    const email = (body.email || '').trim().toLowerCase()
    const name = (body.name || '').trim()
    const password = body.password || ''
    const phone = body.phone?.trim() || undefined

    if (!email || !name || !password) {
      return NextResponse.json({ ok: false, error: 'All fields are required.' }, { status: 400 })
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ ok: false, error: 'Enter a valid email.' }, { status: 400 })
    }
    if (throttled(email)) {
      return NextResponse.json(
        { ok: false, error: 'Too many attempts. Try again later.' },
        { status: 429 },
      )
    }
    const policyError = passwordPolicyError(password)
    if (policyError) {
      return NextResponse.json({ ok: false, error: policyError }, { status: 400 })
    }

    const db = await getDb()
    const users = db.collection<UserDoc>('users')
    const existing = await users.findOne({ email })
    if (existing) {
      return NextResponse.json(
        { ok: false, error: 'An account with this email already exists.' },
        { status: 409 },
      )
    }
    const role = roleForEmail(email)
    const inserted = await users.insertOne({
      email,
      name,
      phone,
      passwordHash: await hashPassword(password),
      role,
      createdAt: new Date(),
    })

    const token = signToken({ sub: String(inserted.insertedId), email, name, role })
    record(email)
    return withSessionCookie(
      NextResponse.json({ ok: true, token, session: { email, name, role } }),
      req,
      token,
    )
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
