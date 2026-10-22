import { NextResponse } from 'next/server'
import { getDb, isMongoConfigured } from '@/lib/mongodb'

export const dynamic = 'force-dynamic'

interface WishDoc {
  _id: string
  items: unknown[]
}

function notConfigured() {
  return NextResponse.json(
    { ok: false, error: 'MONGODB_URI not set on the server.' },
    { status: 503 },
  )
}

// GET /api/wishlist?uid=...  → that user's wishlist items
export async function GET(req: Request) {
  if (!isMongoConfigured) return notConfigured()
  try {
    const uid = new URL(req.url).searchParams.get('uid')
    if (!uid) return NextResponse.json({ ok: true, items: [] })
    const db = await getDb()
    const doc = await db.collection<WishDoc>('wishlists').findOne({ _id: uid })
    return NextResponse.json({ ok: true, items: doc?.items ?? [] })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}

// PUT /api/wishlist  body = { uid, items }  → replace the user's wishlist
export async function PUT(req: Request) {
  if (!isMongoConfigured) return notConfigured()
  try {
    const { uid, items } = await req.json()
    if (!uid) return NextResponse.json({ ok: false, error: 'Missing uid.' }, { status: 400 })
    const db = await getDb()
    await db.collection<WishDoc>('wishlists').updateOne(
      { _id: uid },
      { $set: { _id: uid, items: Array.isArray(items) ? items : [] } },
      { upsert: true },
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
