import { NextResponse } from 'next/server'
import { getDb, isMongoConfigured } from '@/lib/mongodb'
import { authErrorResponse, requireAdmin } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

// PATCH /api/orders/:id   body = { status }   (admin only)
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin(req)
  } catch (e) {
    return authErrorResponse(e)
  }
  if (!isMongoConfigured) {
    return NextResponse.json({ ok: false, error: 'MONGODB_URI not set.' }, { status: 503 })
  }
  try {
    const { id } = await params
    const body = (await req.json()) as { status?: unknown }
    if (typeof body.status !== 'string' || !body.status.trim()) {
      return NextResponse.json({ ok: false, error: 'Missing status.' }, { status: 400 })
    }
    const db = await getDb()
    const res = await db.collection<{ _id: string; status?: string }>('orders').updateOne(
      { _id: id },
      { $set: { status: body.status.trim() } },
    )
    if (res.matchedCount === 0) {
      return NextResponse.json({ ok: false, error: 'Order not found.' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
