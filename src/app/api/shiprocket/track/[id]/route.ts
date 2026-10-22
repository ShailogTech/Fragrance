import { NextResponse } from 'next/server'
import { getDb, isMongoConfigured } from '@/lib/mongodb'
import { authErrorResponse, requireUserStrict } from '@/lib/server-auth'
import { trackOrder, ShiprocketError } from '@/lib/shiprocket'

export const dynamic = 'force-dynamic'

interface OrderShippingDoc {
  _id: string
  uid?: string
  userEmail?: string
  shipping?: {
    provider?: string
    shiprocketOrderId?: string
    awbCode?: string
    courierName?: string
    status?: string
  }
}

// GET /api/shiprocket/track/:orderId → live Shiprocket tracking.
// Allowed for the order's owner or an admin (Bearer token required).
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let user
  try {
    user = await requireUserStrict(req)
  } catch (e) {
    return authErrorResponse(e)
  }
  if (!isMongoConfigured) {
    return NextResponse.json({ ok: false, error: 'MONGODB_URI not set on the server.' }, { status: 503 })
  }

  try {
    const { id } = await params
    const db = await getDb()
    const order = await db.collection<OrderShippingDoc>('orders').findOne({ _id: id })
    if (!order) {
      return NextResponse.json({ ok: false, error: 'Order not found.' }, { status: 404 })
    }
    if (!user.isAdmin && order.uid !== user.uid) {
      return NextResponse.json({ ok: false, error: 'Not your order.' }, { status: 403 })
    }
    if (!order.shipping?.provider) {
      return NextResponse.json(
        { ok: false, error: 'No shipment has been created for this order yet.' },
        { status: 404 },
      )
    }

    const tracking = await trackOrder(order.shipping)
    return NextResponse.json({ ok: true, tracking })
  } catch (e) {
    if (e instanceof ShiprocketError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: e.status || 502 })
    }
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
