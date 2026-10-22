// Shiprocket delivery-partner integration (server-only).
//
// Docs: https://dev.shiprocket.in/ — API base is apiv2.shiprocket.in/v1/external.
// Authentication: email + password of a Shiprocket account → bearer token
// (valid ~10 days). Credentials live in the store settings (MongoDB),
// editable from Admin → Settings; the token is cached there and refreshed
// automatically.
//
// All calls are best-effort from the order flow's point of view: a
// Shiprocket outage must never block an order from being recorded.

import { getSettings, saveSettings, type ShiprocketSettings } from './settings'

const API_BASE = 'https://apiv2.shiprocket.in/v1/external'
const TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // refresh well before expiry

export class ShiprocketError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function api<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), init.timeoutMs ?? 12_000)
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(init.headers || {}),
      },
    })
    const text = await res.text()
    const body = text ? JSON.parse(text) : {}
    if (!res.ok) {
      const message =
        (body as { message?: string; error?: string }).message ||
        (body as { error?: string }).error ||
        `Shiprocket API error ${res.status}`
      throw new ShiprocketError(res.status, message)
    }
    return body as T
  } catch (e) {
    if (e instanceof ShiprocketError) throw e
    if ((e as Error).name === 'AbortError') {
      throw new ShiprocketError(504, 'Shiprocket request timed out.')
    }
    throw new ShiprocketError(0, (e as Error).message)
  } finally {
    clearTimeout(timer)
  }
}

export async function getShiprocketConfig(): Promise<ShiprocketSettings | null> {
  const settings = await getSettings()
  return settings.shiprocket?.email && settings.shiprocket?.password
    ? settings.shiprocket
    : null
}

/**
 * Get a valid Shiprocket bearer token, logging in with the stored
 * credentials and caching the result when necessary.
 */
export async function getShiprocketToken(
  config?: ShiprocketSettings | null,
): Promise<string> {
  const cfg = config ?? (await getShiprocketConfig())
  if (!cfg) throw new ShiprocketError(503, 'Shiprocket is not configured.')

  const fresh = cfg.token && (cfg.tokenFetchedAt ?? 0) > Date.now() - TOKEN_MAX_AGE_MS
  if (fresh && cfg.token) return cfg.token

  const res = await api<{ token: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: cfg.email, password: cfg.password }),
  })
  if (!res.token) throw new ShiprocketError(401, 'Shiprocket rejected the stored credentials.')
  await saveSettings({
    shiprocket: { ...cfg, token: res.token, tokenFetchedAt: Date.now() },
  })
  return res.token
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export interface ShippingOrderInput {
  id: string // store order id, e.g. ORD-XXXX
  createdAt: number
  total: number
  payment?: string // 'cod' | 'upi' | 'card'
  customer?: { name: string; email: string; phone: string }
  shipment?: {
    address: string
    city: string
    state: string
    pincode: string
    notes?: string
  }
  items: Array<{ name: string; quantity: number; price: number }>
}

export interface ShiprocketOrderResult {
  shiprocketOrderId: string
  shipmentId?: string
  awbCode?: string
  courierName?: string
  status?: string
}

/**
 * Push an order to Shiprocket as an ad-hoc order. Weight/dimensions use
 * sensible defaults for incense boxes (0.5 kg, 20×15×5 cm) — adjust in the
 * Shiprocket panel per pickup if needed.
 */
export async function createShiprocketOrder(
  order: ShippingOrderInput,
): Promise<ShiprocketOrderResult> {
  const cfg = await getShiprocketConfig()
  const token = await getShiprocketToken(cfg)

  const name = order.customer?.name || 'Customer'
  const [first, ...rest] = name.split(' ')
  const address: NonNullable<ShippingOrderInput['shipment']> =
    order.shipment ?? ({} as NonNullable<ShippingOrderInput['shipment']>)
  const items = order.items.length
    ? order.items
    : [{ name: 'Shri Fragrance order', quantity: 1, price: order.total }]

  const payload = {
    order_id: order.id,
    order_date: new Date(order.createdAt || Date.now())
      .toISOString()
      .replace('T', ' ')
      .slice(0, 19),
    pickup_location: cfg?.pickupLocation || 'Primary',
    billing_customer_name: first || name,
    billing_last_name: rest.join(' ') || '',
    billing_address: address.address || '',
    billing_address_2: address.notes || '',
    billing_city: address.city || '',
    billing_pincode: address.pincode || '',
    billing_state: address.state || '',
    billing_country: 'India',
    billing_email: order.customer?.email || '',
    billing_phone: order.customer?.phone || '',
    shipping_is_billing: true,
    order_items: items.map((it) => ({
      name: it.name,
      sku: `SF-${it.name.replace(/\s+/g, '-').slice(0, 20).toUpperCase()}`,
      units: it.quantity,
      selling_price: it.price,
    })),
    payment_method: order.payment === 'cod' ? 'COD' : 'Prepaid',
    sub_total: order.total,
    length: 20,
    breadth: 15,
    height: 5,
    weight: 0.5,
  }

  const res = await api<{
    order_id?: number | string
    shipment_id?: number | string
    awb_code?: string
    courier_name?: string
    status?: string
  }>('/orders/create/adhoc', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify(payload),
    timeoutMs: 20_000,
  })

  return {
    shiprocketOrderId: String(res.order_id ?? ''),
    shipmentId: res.shipment_id ? String(res.shipment_id) : undefined,
    awbCode: res.awb_code || undefined,
    courierName: res.courier_name || undefined,
    status: res.status || undefined,
  }
}

// ---------------------------------------------------------------------------
// Tracking
// ---------------------------------------------------------------------------

export interface TrackingActivityResult {
  date: string
  time?: string
  location?: string
  status: string
  remark?: string
}

export interface TrackingResult {
  currentStatus: string
  courier?: string
  awb?: string
  deliveredDate?: string | null
  activities: TrackingActivityResult[]
}

interface TrackResponse {
  tracking_data?: {
    shipment_status?: number | string
    shipment_track?: Array<{
      awb?: string
      courier_name?: string
      current_status?: string
      delivered_date?: string
    }>
    shipment_track_activities?: Array<{
      date?: string
      time?: string
      location?: string
      status?: string
      remark?: string
    }>
    error?: string
  }
}

function mapTracking(body: TrackResponse): TrackingResult {
  const t = body.tracking_data
  const head = t?.shipment_track?.[0]
  return {
    currentStatus:
      head?.current_status ||
      String(t?.shipment_status ?? '') ||
      'In transit',
    courier: head?.courier_name,
    awb: head?.awb,
    deliveredDate: head?.delivered_date || null,
    activities: (t?.shipment_track_activities ?? []).map((a) => ({
      date: a.date || '',
      time: a.time,
      location: a.location,
      status: a.status || '',
      remark: a.remark,
    })),
  }
}

/** Track by AWB number (preferred once an AWB is assigned). */
export async function trackByAwb(awb: string): Promise<TrackingResult> {
  const token = await getShiprocketToken()
  const body = await api<TrackResponse>(
    `/courier/track/awb/${encodeURIComponent(awb)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (body.tracking_data?.error) {
    throw new ShiprocketError(404, body.tracking_data.error)
  }
  return mapTracking(body)
}

/** Track by the store's channel order id (fallback before AWB assignment). */
export async function trackByChannelOrderId(orderId: string): Promise<TrackingResult> {
  const token = await getShiprocketToken()
  const body = await api<TrackResponse>(
    `/courier/track/order/${encodeURIComponent(orderId)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (body.tracking_data?.error) {
    throw new ShiprocketError(404, body.tracking_data.error)
  }
  return mapTracking(body)
}

/** Track a stored order, preferring its AWB when present. */
export async function trackOrder(shipping: {
  awbCode?: string
  shiprocketOrderId?: string
}): Promise<TrackingResult> {
  if (shipping.awbCode) {
    try {
      return await trackByAwb(shipping.awbCode)
    } catch (e) {
      // Fall through to channel-id lookup on not-found style errors.
      if (!(e instanceof ShiprocketError) || e.status >= 500) throw e
    }
  }
  if (shipping.shiprocketOrderId) return trackByChannelOrderId(shipping.shiprocketOrderId)
  throw new ShiprocketError(404, 'No shipment reference on this order yet.')
}

// ---------------------------------------------------------------------------
// Serviceability (optional pre-check)
// ---------------------------------------------------------------------------

export async function checkServiceability(
  deliveryPincode: string,
  cod: boolean,
  declaredValue: number,
  weightKg = 0.5,
): Promise<{ available: boolean; couriers: number; eta?: string }> {
  const cfg = await getShiprocketConfig()
  const token = await getShiprocketToken(cfg)
  const body = await api<{
    data?: {
      available_courier_companies?: Array<{ etd?: string; estimated_delivery_days?: string }>
    }
  }>('/courier/serviceability/', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      pickup_postcode: cfg?.pickupPincode,
      delivery_postcode: deliveryPincode,
      weight: weightKg,
      cod: cod ? 1 : 0,
      declared_value: declaredValue,
    }),
  })
  const couriers = body.data?.available_courier_companies ?? []
  return {
    available: couriers.length > 0,
    couriers: couriers.length,
    eta: couriers[0]?.etd || couriers[0]?.estimated_delivery_days,
  }
}
