import { NextResponse } from 'next/server'
import { getDb, isMongoConfigured } from '@/lib/mongodb'
import { adminProductsSeed } from '@/lib/catalog-data'
import { AuthError, authErrorResponse, requireUser, type VerifiedUser } from '@/lib/server-auth'
import { getSettings } from '@/lib/settings'
import { MIN_ORDER_VALUE, SHIPPING_EXPRESS, SHIPPING_STANDARD } from '@/lib/constants'
import { createShiprocketOrder, ShiprocketError, type ShippingOrderInput } from '@/lib/shiprocket'
import {
  sendOrderConfirmation, sendOwnerNewOrderAlert, type MailOrderView,
} from '@/lib/mailer'

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
    address?: string
    city?: string
    state?: string
    pincode?: string
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
// Online payments only — COD is not offered.
const PAYMENT_METHODS = new Set(['upi', 'card'])

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
// checkout is allowed but the payload is validated strictly. Item prices and
// the total are recomputed server-side from the product catalog — client
// values are never trusted.
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

  if (!order?.id || typeof order.id !== 'string' || !ORDER_ID_RE.test(order.id)) {
    return NextResponse.json({ ok: false, error: 'Invalid order id.' }, { status: 400 })
  }

  const minimum = await minOrderValue()
  if (typeof order.total !== 'number' || !Number.isFinite(order.total) || order.total < minimum) {
    return NextResponse.json(
      { ok: false, error: `Minimum order value is ₹${minimum}.` },
      { status: 400 },
    )
  }
  if (order.payment === 'cod' || order.payment === 'COD') {
    return NextResponse.json(
      { ok: false, error: 'Cash on Delivery is not available. Please pay online via UPI or card.' },
      { status: 400 },
    )
  }
  if (typeof order.payment === 'string' && order.payment && !PAYMENT_METHODS.has(order.payment)) {
    return NextResponse.json({ ok: false, error: 'Unsupported payment method.' }, { status: 400 })
  }

  // Shape validation applies to every order (guest or signed-in).
  if (!Array.isArray(order.items) || order.items.length === 0 || order.items.length > 50) {
    return NextResponse.json({ ok: false, error: 'Order must contain 1-50 items.' }, { status: 400 })
  }
  for (const it of order.items) {
    const qty = Number(it?.quantity)
    if (!Number.isFinite(Number(it?.id)) || typeof it?.name !== 'string' || !Number.isFinite(qty) || qty < 1 || qty > 99) {
      return NextResponse.json({ ok: false, error: 'Invalid order items.' }, { status: 400 })
    }
  }
  if (!user) {
    const email = (order.userEmail || order.customer?.email || '').toLowerCase()
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ ok: false, error: 'A valid email is required.' }, { status: 400 })
    }
  }

  if (!isMongoConfigured) return notConfigured()

  try {
    const db = await getDb()

    // Authoritative pricing: recompute every line from the catalog and
    // rebuild the total. Unknown product ids or tampered prices are rejected.
    const priced = await priceOrder(db, order)
    if (!priced.ok) {
      return NextResponse.json({ ok: false, error: priced.error }, { status: 400 })
    }

    // Field allowlist: only these keys ever reach the database document.
    const safeOrder: OrderDoc & { id: string } = {
      _id: order.id,
      id: order.id,
      items: priced.items,
      total: priced.total,
      status: 'Processing',
      payment: typeof order.payment === 'string' && PAYMENT_METHODS.has(order.payment)
        ? order.payment
        : undefined,
      // Identity comes from the verified token, never from the payload.
      uid: user?.uid,
      userEmail: user
        ? user.email
        : (order.userEmail || order.customer?.email || '').toString().toLowerCase().slice(0, 200),
      createdAt: Number(order.createdAt) || Date.now(),
      customer: pickCustomer(order.customer),
      shipment: pickShipment(order.shipment),
    }

    await db.collection<OrderDoc>('orders').updateOne(
      { _id: order.id },
      { $set: { ...safeOrder, _id: order.id } },
      { upsert: true },
    )

    // Best-effort: create the Shiprocket shipment; failures never block
    // the order. The result is stored on the order document.
    void attachShipping(safeOrder)

    // Best-effort notifications: customer confirmation + owner alert.
    void notifyNewOrder(safeOrder)

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}

const str = (v: unknown, max: number): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined

function pickCustomer(c: OrderDoc['customer']): OrderDoc['customer'] {
  if (!c) return undefined
  return {
    name: str(c.name, 100),
    email: str(c.email, 200)?.toLowerCase(),
    phone: str(c.phone, 20),
  }
}

function pickShipment(s: OrderDoc['shipment']): OrderDoc['shipment'] {
  if (!s) return undefined
  return {
    address: str(s.address, 300),
    city: str(s.city, 60),
    state: str(s.state, 60),
    pincode: str(s.pincode, 6),
    notes: str(s.notes, 300),
    method: s.method === 'express' ? 'express' : 'standard',
  }
}

interface PricedOrder {
  ok: true
  items: OrderItemDoc[]
  total: number
}

async function priceOrder(
  db: Awaited<ReturnType<typeof getDb>>,
  order: OrderDoc,
): Promise<PricedOrder | { ok: false; error: string }> {
  const col = db.collection<{ _id: number; name?: string; price?: unknown }>('products')
  let catalog = await col.find({}, { projection: { name: 1, price: 1 } }).toArray()
  if (catalog.length === 0) {
    await col.insertMany(adminProductsSeed.map((p) => ({ ...p, _id: p.id })))
    catalog = await col.find({}, { projection: { name: 1, price: 1 } }).toArray()
  }
  const byId = new Map(catalog.map((p) => [p._id, p]))

  const items: OrderItemDoc[] = []
  let subtotal = 0
  for (const it of order.items ?? []) {
    const product = byId.get(Number(it?.id))
    if (!product) {
      return { ok: false, error: 'Some items in your cart are no longer available. Please refresh and try again.' }
    }
    const quantity = Math.min(99, Math.max(1, Math.round(Number(it?.quantity) || 1)))
    const unitPrice = parseCatalogPrice(product.price)
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return { ok: false, error: 'A product price is unavailable. Please contact support.' }
    }
    subtotal += unitPrice * quantity
    items.push({ id: product._id, name: product.name || 'Item', price: unitPrice, quantity })
  }

  const minimum = await minOrderValue()
  // Flat shipping fee for every order — there is no free-shipping tier.
  const shippingFee = pickShipment(order.shipment)?.method === 'express'
    ? SHIPPING_EXPRESS
    : SHIPPING_STANDARD
  const total = subtotal + shippingFee
  if (total < minimum) {
    return { ok: false, error: `Minimum order value is ₹${minimum}.` }
  }
  return { ok: true, items, total }
}

function parseCatalogPrice(price: unknown): number {
  if (typeof price === 'number') return price
  if (typeof price !== 'string') return NaN
  const n = Number.parseInt(price.replace(/[^\d]/g, ''), 10)
  return Number.isFinite(n) ? n : NaN
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

function toMailView(order: OrderDoc): MailOrderView {
  return {
    id: String(order.id),
    total: Number(order.total) || 0,
    items: (order.items ?? []).map((it) => ({
      name: String(it?.name ?? 'Item'),
      quantity: Number(it?.quantity) || 1,
      price: Number(it?.price) || 0,
    })),
    customer: order.customer as MailOrderView['customer'],
    shipment: order.shipment as MailOrderView['shipment'],
    shipping: order.shipping as MailOrderView['shipping'],
  }
}

async function notifyNewOrder(order: OrderDoc): Promise<void> {
  const view = toMailView(order)
  await Promise.allSettled([
    sendOrderConfirmation(view),
    sendOwnerNewOrderAlert(view),
  ])
}
