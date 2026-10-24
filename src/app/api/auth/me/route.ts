import { NextResponse } from 'next/server'
import { authErrorResponse, requireUser } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

// GET /api/auth/me  (Authorization: Bearer <token>)
// → { ok, session: { email, name, role } } — lets clients re-validate a
// stored token and refresh their cached session.
export async function GET(req: Request) {
  try {
    const user = await requireUser(req)
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Sign-in required.' }, { status: 401 })
    }
    // The name isn't on VerifiedUser; the client keeps it in its cached
    // session, so return what the server can attest to.
    return NextResponse.json({
      ok: true,
      session: { email: user.email, isAdmin: user.isAdmin },
    })
  } catch (e) {
    return authErrorResponse(e)
  }
}
