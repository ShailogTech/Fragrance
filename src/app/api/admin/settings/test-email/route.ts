import { NextResponse } from 'next/server'
import { authErrorResponse, requireAdmin } from '@/lib/server-auth'
import { sendTestEmail } from '@/lib/mailer'

export const dynamic = 'force-dynamic'

// POST /api/admin/settings/test-email  body = { to }
// Verifies the saved SMTP settings by sending a test message (admin only).
export async function POST(req: Request) {
  try {
    await requireAdmin(req)
  } catch (e) {
    return authErrorResponse(e)
  }
  try {
    const body = (await req.json()) as { to?: string }
    const to = (body.to || '').trim()
    if (!to) {
      return NextResponse.json({ ok: false, error: 'Enter a recipient email.' }, { status: 400 })
    }
    await sendTestEmail(to)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 })
  }
}
