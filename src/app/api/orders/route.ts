import { NextResponse } from 'next/server'
import { getDb, isMongoConfigured } from '@/lib/mongodb'
import { AuthError, authErrorResponse, requireUser, type VerifiedUser } from '@/lib/server-auth'
import { getSettings } from '@/lib/settings'
import { MIN_ORDER_VALUE } from '@/lib/constants'
import { createShiprocketOrder, ShiprocketError, type ShippingOrderInput } from '@/lib/shiprocket'

export const dynamic = 'force-dynamic'

interface OrderItemDoc {
  id?: number
  name?: string
  price?: number
  quantity?: number
}

interface OrderDoc {
  _id: string
  id?: string
  uid?: string
  userEmail?: string
  createdAt?: number
  total?: number
  payment?: string
  items?: OrderItemDoc[]
  customer?: { name?: string; email?: string; phone?: string }
  shipment?: {
    address: string
    city: string
    state: string
    pincode: string
    notes?: string
    method?: string
  }
  [key: string]: unknown
}

function notConfigured() {
  return NextResponse.json(
    { ok: false, error: 'MONGODB_URI not set on the server.' },
    { status: 503 },
  )
}

const EMAIL_RE = /^\S+@\S+\.\S+$/
const ORDER_ID_RE = /^ORD-[A-Z0-9]{4,30}$/

async function minOrderValue(): Promise<number> {
  if (!isMongoConfigured) return MIN_ORDER_VALUE
  try {
    const settings = await getSettings()
    return settings.minOrderValue || MIN_ORDER_VALUE
  } catch {
    return MIN_ORDER_VALUE
  }
}

// GET /api/orders            (Bearer token) → that user's orders
// GET /api/orders?all=1      (admin Bearer) → all orders
export async function GET(req: Request) {
  let user
  try {
    user = await requireUser(req)
  } catch (e) {
    return authErrorResponse(e)
  }
  if (!user) {
    return NextResponse.json({ ok: false, error: 'Sign-in required.' }, { status: 401 })
  }
  if (!isMongoConfigured) return notConfigured()

  try {
    const url = new URL(req.url)
    const all = url.searchParams.get('all')
    const db = await getDb()
    const col = db.collection<OrderDoc>('orders')

    let docs
    if (all === '1' && user.isAdmin) {
      docs = await col.find({}, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray()
    } else {
      docs = await col.find({ uid: user.uid }, { projection: { _id: 0 } }).sort({ createdAt: -1 }).toArray()
    }
    return NextResponse.json({ ok: true, orders: docs })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}

// POST /api/orders — record a placed order (and push it to Shiprocket when
// configured). Signed-in users authenticate with a Bearer token; guest
// checkout is allowed but the payload is validated strictly.
export async function POST(req: Request) {
  let user: VerifiedUser | null = null
  try {
    user = await requireUser(req)
  } catch (e) {
    if (e instanceof AuthError) return authErrorResponse(e)
    user = null // network hiccup verifying a token — treat as guest below
  }

  let order: OrderDoc
  try {
    order = (await req.json()) as OrderDoc
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  if (!order?.id || typeof order.id !== 'string') {
    return NextResponse.json({ ok: false, error: 'Missing order id.' }, { status: 400 })
  }

  const minimum = await minOrderValue()
  if (typeof order.total !== 'number' || !Number.isFinite(order.total) || order.total < minimum) {
    return NextResponse.json(
      { ok: false, error: `Minimum order value is ₹${minimum}.` },
      { status: 400 },
    )
  }

  // Guest orders must be well-formed; signed-in orders are already
  // authenticated via the verified token.
  if (!user) {
    if (!ORDER_ID_RE.test(order.id)) {
      return NextResponse.json({ ok: false, error: 'Invalid order id.' }, { status: 400 })
    }
    const email = (order.userEmail || order.customer?.email || '').toLowerCase()
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: false, error: 'A valid email is required.' }, { status: 400 })
    }
    if (!Array.isArray(order.items) || order.items.length === 0 || order.items.length > 50) {
      return NextResponse.json({ ok: false, error: 'Order must contain 1–50 items.' }, { status: 400 })
    }
    const itemsTotal = order.items.reduce(
      (sum, it) => sum + (Number(it?.price) || 0) * (Number(it?.quantity) || 0),
      0,
    )
    // 10% slack covers shipping fees; more means a tampered total.
    if (itemsTotal > 0 && order.total < itemsTotal * 0.9) {
      return NextResponse.json({ ok: false, error: 'Order total mismatch.' }, { status: 400 })
    }
    // Guests cannot claim another account's identity.
    order.uid = undefined
  }

  if (!isMongoConfigured) return notConfigured()

  try {
    const db = await getDb()
    await db.collection<OrderDoc>('orders').updateOne(
      { _id: order.id },
      { $set: { ...order, _id: order.id } },
      { upsert: true },
    )

    // Best-effort: create the Shiprocket shipment; failures never block
    // the order. The result is stored on the order document.
    void attachShipping({ ...order, id: String(order.id) })

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}

async function attachShipping(order: OrderDoc & { id: string }): Promise<void> {
  try {
    const result = await createShiprocketOrder({
      id: order.id,
      createdAt: order.createdAt ?? Date.now(),
      total: Number(order.total) || 0,
      payment: typeof order.payment === 'string' ? order.payment : undefined,
      customer: order.customer as ShippingOrderInput['customer'],
      shipment: order.shipment as ShippingOrderInput['shipment'],
      items: (order.items ?? []).map((it) => ({
        name: String(it?.name ?? 'Item'),
        quantity: Number(it?.quantity) || 1,
        price: Number(it?.price) || 0,
      })),
    })
    if (!result.shiprocketOrderId) return
    const db = await getDb()
    const shipping: Record<string, unknown> = {
      provider: 'shiprocket',
      shiprocketOrderId: result.shiprocketOrderId,
      shipmentId: result.shipmentId,
      awbCode: result.awbCode,
      courierName: result.courierName,
      status: result.status || 'NEW',
    }
    await db.collection<OrderDoc>('orders').updateOne(
      { _id: order.id },
      { $set: { shipping } },
    )
  } catch (e) {
    if (e instanceof ShiprocketError && (e.status === 503 || e.status === 0)) return // not configured
    console.warn(`[shiprocket] could not create shipment for ${order.id}:`, (e as Error).message)
  }
}
