import { NextResponse } from 'next/server'
import { getDb, isMongoConfigured } from '@/lib/mongodb'
import { authErrorResponse, requireUserStrict, type VerifiedUser } from '@/lib/server-auth'
import { sendShippingNotification, type MailOrderView } from '@/lib/mailer'

export const dynamic = 'force-dynamic'

interface OrderDoc {
  _id: string
  uid?: string
  userEmail?: string
  status?: string
  total?: number
  items?: Array<{ id?: number; name?: string; quantity?: number; price?: number }>
  payment?: string
  customer?: { name?: string; email?: string; phone?: string }
  shipment?: { address?: string; city?: string; state?: string; pincode?: string; notes?: string; method?: string }
  shipping?: { provider?: string; shiprocketOrderId?: string; awbCode?: string; courierName?: string; status?: string }
  createdAt?: number
}

function notConfigured() {
  return NextResponse.json({ ok: false, error: 'MONGODB_URI not set.' }, { status: 503 })
}

function strip(doc: OrderDoc): Omit<OrderDoc, '_id'> {
  const { _id, uid, ...rest } = doc
  return rest
}

// GET /api/orders/:id → one order, visible only to its owner or an admin.
// (IDOR guard: the uid comes from the verified session, never the URL.)
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let user: VerifiedUser
  try {
    user = await requireUserStrict(req)
  } catch (e) {
    return authErrorResponse(e)
  }
  if (!isMongoConfigured) return notConfigured()
  try {
    const { id } = await params
    if (!/^ORD-[A-Z0-9]{4,30}$/.test(id)) {
      return NextResponse.json({ ok: false, error: 'Invalid order id.' }, { status: 400 })
    }
    const db = await getDb()
    const order = await db.collection<OrderDoc>('orders').findOne(
      { _id: id },
      { projection: { _id: 0, uid: 1, userEmail: 1, status: 1, total: 1, items: 1, payment: 1, customer: 1, shipment: 1, shipping: 1, createdAt: 1 } },
    )
    // Not-found for other people's orders (don't confirm existence).
    if (!order || (!user.isAdmin && order.uid !== user.uid)) {
      return NextResponse.json({ ok: false, error: 'Order not found.' }, { status: 404 })
    }
    return NextResponse.json({ ok: true, order: { id, ...strip(order) } })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}

// PATCH /api/orders/:id   body = { status }
//   • admin: any status (also emails tracking details when marked Shipped)
//   • the order's owner: may set status to 'Cancelled' while it is still
//     'Processing' — nobody else's order, nobody else's state.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let user: VerifiedUser
  try {
    user = await requireUserStrict(req)
  } catch (e) {
    return authErrorResponse(e)
  }
  if (!isMongoConfigured) return notConfigured()
  try {
    const { id } = await params
    if (!/^ORD-[A-Z0-9]{4,30}$/.test(id)) {
      return NextResponse.json({ ok: false, error: 'Invalid order id.' }, { status: 400 })
    }
    const body = (await req.json()) as { status?: unknown }
    if (typeof body.status !== 'string' || !body.status.trim()) {
      return NextResponse.json({ ok: false, error: 'Missing status.' }, { status: 400 })
    }
    const status = body.status.trim()

    const db = await getDb()
    const col = db.collection<OrderDoc>('orders')
    const order = await col.findOne({ _id: id })
    if (!order) {
      return NextResponse.json({ ok: false, error: 'Order not found.' }, { status: 404 })
    }

    if (!user.isAdmin) {
      // Owner self-service: cancel-while-processing only, own orders only.
      if (order.uid !== user.uid) {
        return NextResponse.json({ ok: false, error: 'Order not found.' }, { status: 404 })
      }
      if (status !== 'Cancelled') {
        return NextResponse.json({ ok: false, error: 'Only cancelling is allowed.' }, { status: 403 })
      }
      if (order.status !== 'Processing') {
        return NextResponse.json(
          { ok: false, error: 'This order can no longer be cancelled. Contact support.' },
          { status: 409 },
        )
      }
    }

    const res = await col.updateOne({ _id: id }, { $set: { status } })
    if (res.matchedCount === 0) {
      return NextResponse.json({ ok: false, error: 'Order not found.' }, { status: 404 })
    }

    // When an order is marked Shipped, email the customer tracking details
    // (best-effort — never blocks the status update).
    if (status === 'Shipped') {
      void (async () => {
        try {
          const fresh = await col.findOne({ _id: id })
          if (!fresh?.customer?.email) return
          const view: MailOrderView = {
            id: fresh._id,
            total: Number(fresh.total) || 0,
            items: (fresh.items ?? []).map((it) => ({
              name: String(it?.name ?? 'Item'),
              quantity: Number(it?.quantity) || 1,
              price: Number(it?.price) || 0,
            })),
            customer: fresh.customer,
            shipment: fresh.shipment,
            shipping: fresh.shipping,
          }
          await sendShippingNotification(view)
        } catch (e) {
          console.warn(`[email] shipping notice for ${id} failed:`, (e as Error).message)
        }
      })()
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
