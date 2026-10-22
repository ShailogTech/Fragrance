// Store settings, persisted in MongoDB (single 'store' document).
//
// Secrets (Shiprocket password + token, SMTP password) are stored here but
// are write-only through the API — the settings route never returns them.
//
// Server-only.

import { getDb } from './mongodb'
import { MIN_ORDER_VALUE } from './constants'

export interface ShiprocketSettings {
  email: string
  password: string // secret — never returned to clients
  pickupPincode: string
  pickupLocation?: string // Shiprocket pickup location name, default 'Primary'
  token?: string // cached auth token (secret)
  tokenFetchedAt?: number // epoch ms
}

export interface EmailSettings {
  smtpHost: string
  smtpPort: number // 587 (STARTTLS) or 465 (implicit TLS)
  smtpSecure: boolean
  username: string
  password: string // secret — never returned to clients
  fromAddress: string // e.g. 'Shri Fragrance <orders@shrifragrance.com>'
  ownerEmail: string // where new-order notifications go
  siteUrl: string // absolute URL used in email links, no trailing slash
}

export interface StoreSettings {
  _id: 'store'
  minOrderValue: number
  shiprocket: ShiprocketSettings | null
  email: EmailSettings | null
}

const DEFAULTS: StoreSettings = {
  _id: 'store',
  minOrderValue: MIN_ORDER_VALUE,
  shiprocket: null,
  email: null,
}

export async function getSettings(): Promise<StoreSettings> {
  const db = await getDb()
  const doc = await db.collection<StoreSettings>('settings').findOne({ _id: 'store' })
  return doc ? { ...DEFAULTS, ...doc } : DEFAULTS
}

export async function saveSettings(patch: Partial<StoreSettings>): Promise<StoreSettings> {
  const db = await getDb()
  await db.collection<StoreSettings>('settings').updateOne(
    { _id: 'store' },
    { $set: { ...DEFAULTS, ...(await getSettings()), ...patch, _id: 'store' } },
    { upsert: true },
  )
  return getSettings()
}

/** Settings safe to send to the admin UI (secrets stripped). */
export function publicSettings(s: StoreSettings) {
  return {
    minOrderValue: s.minOrderValue,
    shiprocket: s.shiprocket
      ? {
          email: s.shiprocket.email,
          pickupPincode: s.shiprocket.pickupPincode,
          pickupLocation: s.shiprocket.pickupLocation || 'Primary',
          tokenCached: Boolean(s.shiprocket.token),
        }
      : null,
    email: s.email
      ? {
          smtpHost: s.email.smtpHost,
          smtpPort: s.email.smtpPort,
          smtpSecure: s.email.smtpSecure,
          username: s.email.username,
          fromAddress: s.email.fromAddress,
          ownerEmail: s.email.ownerEmail,
          siteUrl: s.email.siteUrl,
        }
      : null,
  }
}
