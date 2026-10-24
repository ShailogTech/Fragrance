import { NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

// POST /api/auth/logout → clears the session cookie.
export async function POST() {
  return clearSessionCookie(NextResponse.json({ ok: true }))
}
