import { NextResponse } from 'next/server'
import { getDb, isMongoConfigured } from '@/lib/mongodb'
import { authErrorResponse, requireAdmin } from '@/lib/server-auth'
import { sendShippingNotification, type MailOrderView } from '@/lib/mailer'

export const dynamic = 'force-dynamic'

interface OrderMailDoc {
  _id: string
  total?: number
  items?: Array<{ name?: string; quantity?: number; price?: number }>
  customer?: { name?: string; email?: string; phone?: string }
  shipment?: { address?: string; city?: string; state?: string; pincode?: string }
  shipping?: { courierName?: string; awbCode?: string; status?: string }
}

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
    const status = body.status.trim()
    const db = await getDb()
    const col = db.collection<OrderMailDoc>('orders')
    const res = await col.updateOne(
      { _id: id },
      { $set: { status } },
    )
    if (res.matchedCount === 0) {
      return NextResponse.json({ ok: false, error: 'Order not found.' }, { status: 404 })
    }

    // When an order is marked Shipped, email the customer tracking details
    // (best-effort — never blocks the status update).
    if (status === 'Shipped') {
      void (async () => {
        try {
          const order = await col.findOne({ _id: id })
          if (!order?.customer?.email) return
          const view: MailOrderView = {
            id: order._id,
            total: Number(order.total) || 0,
            items: (order.items ?? []).map((it) => ({
              name: String(it?.name ?? 'Item'),
              quantity: Number(it?.quantity) || 1,
              price: Number(it?.price) || 0,
            })),
            customer: order.customer,
            shipment: order.shipment,
            shipping: order.shipping,
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
