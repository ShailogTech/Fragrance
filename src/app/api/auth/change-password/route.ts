import { NextResponse } from 'next/server'
import { getDb } from '@/lib/mongodb'
import { hashPassword, verifyPassword, type UserDoc } from '@/lib/auth-core'
import { authErrorResponse, requireUserStrict } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

// POST /api/auth/change-password  (Authorization: Bearer <token>)
// body = { currentPassword, newPassword }
export async function POST(req: Request) {
  try {
    const user = await requireUserStrict(req)
    const body = (await req.json()) as { currentPassword?: string; newPassword?: string }
    const currentPassword = body.currentPassword || ''
    const newPassword = body.newPassword || ''
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { ok: false, error: 'Please fill in all password fields.' },
        { status: 400 },
      )
    }
    if (newPassword.length < 6) {
      return NextResponse.json(
        { ok: false, error: 'Password must be at least 6 characters long.' },
        { status: 400 },
      )
    }

    const db = await getDb()
    const users = db.collection<UserDoc>('users')
    const doc = await users.findOne({ email: user.email })
    if (!doc) {
      return NextResponse.json(
        { ok: false, error: 'Account not found. Please sign up again.' },
        { status: 404 },
      )
    }
    if (!(await verifyPassword(currentPassword, doc.passwordHash))) {
      return NextResponse.json({ ok: false, error: 'Current password is incorrect.' }, { status: 401 })
    }
    await users.updateOne(
      { _id: doc._id },
      { $set: { passwordHash: await hashPassword(newPassword) } },
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    return authErrorResponse(e)
  }
}
