import { NextResponse } from 'next/server'
import { getDb, isMongoConfigured } from '@/lib/mongodb'
import { authErrorResponse, requireUserStrict } from '@/lib/server-auth'

export const dynamic = 'force-dynamic'

interface CartDoc {
  _id: string
  items: unknown[]
}

function notConfigured() {
  return NextResponse.json(
    { ok: false, error: 'MONGODB_URI not set on the server.' },
    { status: 503 },
  )
}

// GET /api/cart → the signed-in user's cart items
export async function GET(req: Request) {
  let user
  try {
    user = await requireUserStrict(req)
  } catch (e) {
    return authErrorResponse(e)
  }
  if (!isMongoConfigured) return notConfigured()
  try {
    const db = await getDb()
    const doc = await db.collection<CartDoc>('carts').findOne({ _id: user.uid })
    return NextResponse.json({ ok: true, items: doc?.items ?? [] })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}

// PUT /api/cart  body = { items } → replace the signed-in user's cart
export async function PUT(req: Request) {
  let user
  try {
    user = await requireUserStrict(req)
  } catch (e) {
    return authErrorResponse(e)
  }
  if (!isMongoConfigured) return notConfigured()
  try {
    const { items } = (await req.json()) as { items?: unknown }
    const db = await getDb()
    await db.collection<CartDoc>('carts').updateOne(
      { _id: user.uid },
      { $set: { _id: user.uid, items: Array.isArray(items) ? items.slice(0, 200) : [] } },
      { upsert: true },
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
