import { NextResponse } from 'next/server'
import { getDb, isMongoConfigured } from '@/lib/mongodb'

export const dynamic = 'force-dynamic'

// PATCH /api/orders/:id   body = { status }
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isMongoConfigured) {
    return NextResponse.json({ ok: false, error: 'MONGODB_URI not set.' }, { status: 503 })
  }
  try {
    const { id } = await params
    const { status } = await req.json()
    if (!status) {
      return NextResponse.json({ ok: false, error: 'Missing status.' }, { status: 400 })
    }
    const db = await getDb()
    const res = await db.collection<{ _id: string; status?: string }>('orders').updateOne(
      { _id: id },
      { $set: { status } },
    )
    if (res.matchedCount === 0) {
      return NextResponse.json({ ok: false, error: 'Order not found.' }, { status: 404 })
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
