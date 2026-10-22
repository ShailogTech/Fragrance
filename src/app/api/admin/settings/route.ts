import { NextResponse } from 'next/server'
import { isMongoConfigured } from '@/lib/mongodb'
import { authErrorResponse, requireAdmin } from '@/lib/server-auth'
import { getSettings, publicSettings, saveSettings } from '@/lib/settings'
import { MIN_ORDER_VALUE } from '@/lib/constants'

export const dynamic = 'force-dynamic'

function notConfigured() {
  return NextResponse.json(
    { ok: false, error: 'MONGODB_URI not set on the server.' },
    { status: 503 },
  )
}

// GET /api/admin/settings → store settings (secrets never included).
export async function GET(req: Request) {
  try {
    await requireAdmin(req)
  } catch (e) {
    return authErrorResponse(e)
  }
  if (!isMongoConfigured) return notConfigured()
  try {
    return NextResponse.json({ ok: true, settings: publicSettings(await getSettings()) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}

// PUT /api/admin/settings
//   body: {
//     shiprocket?: { email, password?, pickupPincode, pickupLocation? },
//     clearShiprocket?: true,
//     minOrderValue?: number
//   }
// A blank/missing password keeps the stored one (write-only secret).
export async function PUT(req: Request) {
  let body: {
    shiprocket?: { email?: string; password?: string; pickupPincode?: string; pickupLocation?: string }
    clearShiprocket?: boolean
    minOrderValue?: number
  }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body.' }, { status: 400 })
  }

  try {
    await requireAdmin(req)
  } catch (e) {
    return authErrorResponse(e)
  }
  if (!isMongoConfigured) return notConfigured()

  try {
    const current = await getSettings()

    if (body.clearShiprocket) {
      await saveSettings({ shiprocket: null })
      return NextResponse.json({ ok: true, settings: publicSettings(await getSettings()) })
    }

    const patch: Parameters<typeof saveSettings>[0] = {}

    if (typeof body.minOrderValue === 'number') {
      if (!Number.isFinite(body.minOrderValue) || body.minOrderValue < 0) {
        return NextResponse.json({ ok: false, error: 'minOrderValue must be a positive number.' }, { status: 400 })
      }
      patch.minOrderValue = Math.round(body.minOrderValue)
    } else if (current.minOrderValue == null) {
      patch.minOrderValue = MIN_ORDER_VALUE
    }

    if (body.shiprocket) {
      const incoming = body.shiprocket
      const email = (incoming.email ?? current.shiprocket?.email ?? '').trim()
      const pincode = (incoming.pickupPincode ?? current.shiprocket?.pickupPincode ?? '').trim()
      if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
        return NextResponse.json({ ok: false, error: 'A valid Shiprocket email is required.' }, { status: 400 })
      }
      if (!/^\d{6}$/.test(pincode)) {
        return NextResponse.json({ ok: false, error: 'Pickup pincode must be 6 digits.' }, { status: 400 })
      }
      const password = incoming.password?.trim()
      if (password === undefined || password === '') {
        if (!current.shiprocket?.password) {
          return NextResponse.json({ ok: false, error: 'Shiprocket password is required on first setup.' }, { status: 400 })
        }
      }
      const existing = current.shiprocket
      const credentialsChanged =
        password !== undefined && password !== '' && password !== existing?.password
      const emailChanged = email !== existing?.email

      patch.shiprocket = {
        email,
        password: password && password !== '' ? password : existing!.password,
        pickupPincode: pincode,
        pickupLocation: (incoming.pickupLocation || existing?.pickupLocation || 'Primary').trim() || 'Primary',
        // Any credential change invalidates the cached token.
        ...(credentialsChanged || emailChanged
          ? { token: undefined, tokenFetchedAt: undefined }
          : { token: existing?.token, tokenFetchedAt: existing?.tokenFetchedAt }),
      }
    }

    await saveSettings(patch)
    return NextResponse.json({ ok: true, settings: publicSettings(await getSettings()) })
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 500 })
  }
}
