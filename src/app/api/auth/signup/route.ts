import { NextResponse } from 'next/server'
import { getDb, isMongoConfigured } from '@/lib/mongodb'
import { hashPassword, roleForEmail, signToken, type UserDoc } from '@/lib/auth-core'

export const dynamic = 'force-dynamic'

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
    if (password.length < 6) {
      return NextResponse.json(
        { ok: false, error: 'Password must be at least 6 characters.' },
        { status: 400 },
      )
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
    return NextResponse.json({ ok: true, token, session: { email, name, role } })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
