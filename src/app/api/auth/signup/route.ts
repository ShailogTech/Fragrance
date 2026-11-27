import { NextResponse } from 'next/server'
import { getDb, isMongoConfigured } from '@/lib/mongodb'
import {
  hashPassword,
  newTokenVersion,
  passwordPolicyError,
  roleForEmail,
  signToken,
  type UserDoc,
} from '@/lib/auth-core'
import { clientAddress, serverErrorResponse, withSessionCookie } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

// Sign-ups are counted per source address (not per e-mail, which an
// enumerator simply changes), so one place can't mass-create accounts.
const MAX_SIGNUPS_PER_ADDRESS = 10
const WINDOW_MS = 60 * 60 * 1000
const byAddress = new Map<string, { count: number; resetAt: number }>()

function limited(address: string): boolean {
  const rec = byAddress.get(address)
  if (!rec || Date.now() > rec.resetAt) return false
  return rec.count >= MAX_SIGNUPS_PER_ADDRESS
}

function record(address: string): void {
  const now = Date.now()
  const rec = byAddress.get(address)
  if (!rec || now > rec.resetAt) byAddress.set(address, { count: 1, resetAt: now + WINDOW_MS })
  else rec.count += 1
}

// POST /api/auth/signup  body = { email, name, password, phone? }
export async function POST(req: Request) {
  if (!isMongoConfigured) {
    return NextResponse.json({ ok: false, error: 'Sign-up is temporarily unavailable.' }, { status: 503 })
  }
  const address = clientAddress(req)
  try {
    let body: { email?: string; name?: string; password?: string; phone?: string }
    try {
      body = (await req.json()) as typeof body
    } catch {
      return NextResponse.json({ ok: false, error: 'Invalid request.' }, { status: 400 })
    }
    const email = String(body.email || '').trim().toLowerCase().slice(0, 200)
    const name = String(body.name || '').trim().slice(0, 100)
    const password = String(body.password || '')
    const phone = body.phone ? String(body.phone).trim().slice(0, 20) || undefined : undefined

    if (!email || !name || !password) {
      return NextResponse.json({ ok: false, error: 'All fields are required.' }, { status: 400 })
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ ok: false, error: 'Enter a valid email.' }, { status: 400 })
    }
    if (limited(address)) {
      return NextResponse.json(
        { ok: false, error: 'Too many accounts created from this connection. Try again later.' },
        { status: 429 },
      )
    }
    const policyError = passwordPolicyError(password)
    if (policyError) {
      return NextResponse.json({ ok: false, error: policyError }, { status: 400 })
    }

    const db = await getDb()
    const users = db.collection<UserDoc>('users')
    if (await users.findOne({ email }, { projection: { _id: 1 } })) {
      return NextResponse.json(
        { ok: false, error: 'An account with this email already exists.' },
        { status: 409 },
      )
    }
    const role = roleForEmail(email)
    const tokenVersion = newTokenVersion()
    let insertedId: unknown
    try {
      ;({ insertedId } = await users.insertOne({
        email,
        name,
        phone,
        passwordHash: await hashPassword(password),
        role,
        tokenVersion,
        createdAt: new Date(),
      }))
    } catch (e) {
      // Two sign-ups racing on the same address: the unique index decides.
      if ((e as { code?: number }).code === 11000) {
        return NextResponse.json(
          { ok: false, error: 'An account with this email already exists.' },
          { status: 409 },
        )
      }
      throw e
    }
    record(address)

    const token = signToken({ sub: String(insertedId), email, name, role, tv: tokenVersion })
    return withSessionCookie(
      NextResponse.json({ ok: true, session: { email, name, role } }),
      req,
      token,
    )
  } catch (e) {
    return serverErrorResponse(e, 'auth signup')
  }
}
