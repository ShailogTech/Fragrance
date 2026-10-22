import { NextResponse } from 'next/server'
import { getDb, isMongoConfigured } from '@/lib/mongodb'

export const dynamic = 'force-dynamic'

const ADMIN_EMAILS = new Set(['admin@shrifragrance.com'])

interface OrderDoc {
  _id: string
  uid?: string
  userEmail?: string
  createdAt?: number
  [key: string]: unknown
}

function notConfigured() {
  return NextResponse.json(
    { ok: false, error: 'MONGODB_URI not set on the server.' },
    { status: 503 },
  )
}

// GET /api/orders?uid=...            → that user's orders
// GET /api/orders?all=1&email=admin… → all orders (admin only)
export async function GET(req: Request) {
  if (!isMongoConfigured) return notConfigured()
  try {
    const url = new URL(req.url)
    const uid = url.searchParams.get('uid')
    const all = url.searchParams.get('all')
    const email = (url.searchParams.get('email') || '').toLowerCase()

    const db = await getDb()
    const col = db.collection<OrderDoc>('orders')

    let docs
    if (all === '1' && ADMIN_EMAILS.has(email)) {
      docs = await col.find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray()
    } else if (uid) {
      docs = await col.find({ uid }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray()
    } else {
      docs = []
    }
    return NextResponse.json({ ok: true, orders: docs })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}

// POST /api/orders  body = full order (with id, uid, userEmail, createdAt)
export async function POST(req: Request) {
  if (!isMongoConfigured) return notConfigured()
  try {
    const order = await req.json()
    if (!order?.id) {
      return NextResponse.json({ ok: false, error: 'Missing order id.' }, { status: 400 })
    }
    const db = await getDb()
    await db.collection<OrderDoc>('orders').updateOne(
      { _id: order.id },
      { $set: { ...order, _id: order.id } },
      { upsert: true },
    )
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
