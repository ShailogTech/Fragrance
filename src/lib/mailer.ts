// Transactional email (server-only).
//
// SMTP credentials live in the store settings (Admin → Settings → Email);
// nothing is sent until they are configured. Every send is best-effort:
// email problems must never block an order, and errors are logged with
// context but without credentials.

import nodemailer, { type Transporter } from 'nodemailer'
import { getSettings, type EmailSettings } from './settings'

export interface MailOrderView {
  id: string
  total: number
  items: Array<{ name: string; quantity: number; price: number }>
  customer?: { name?: string; email?: string; phone?: string }
  shipment?: { address?: string; city?: string; state?: string; pincode?: string }
  shipping?: { courierName?: string; awbCode?: string; status?: string }
}

let cachedTransport: { key: string; cfg: EmailSettings; transporter: Transporter } | null = null

function transportKey(cfg: EmailSettings): string {
  return `${cfg.smtpHost}:${cfg.smtpPort}:${cfg.username}:${cfg.password.length}:${cfg.smtpSecure}`
}

async function getTransport(): Promise<{ cfg: EmailSettings; transporter: Transporter } | null> {
  const settings = await getSettings()
  const cfg = settings.email
  if (!cfg?.smtpHost || !cfg?.username || !cfg?.password || !cfg?.fromAddress) return null
  const key = transportKey(cfg)
  if (!cachedTransport || cachedTransport.key !== key) {
    cachedTransport = {
      key,
      cfg,
      transporter: nodemailer.createTransport({
        host: cfg.smtpHost,
        port: cfg.smtpPort || 587,
        secure: cfg.smtpSecure,
        auth: { user: cfg.username, pass: cfg.password },
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 15_000,
      }),
    }
  }
  return cachedTransport
}

export async function isEmailConfigured(): Promise<boolean> {
  return (await getTransport()) !== null
}

async function send(to: string, subject: string, html: string, text: string): Promise<void> {
  const t = await getTransport()
  if (!t) return // not configured — silently skip (checked by callers for logging)
  await t.transporter.sendMail({
    from: t.cfg.fromAddress,
    to,
    subject,
    html,
    text,
  })
}

// ── Templates ─────────────────────────────────────────────────────────────

const BRAND = `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;
              border:1px solid #e5d9b8;border-radius:12px;overflow:hidden">
    <div style="background:#800020;padding:18px 24px;text-align:center">
      <span style="color:#FFBF00;font-weight:bold;letter-spacing:2px;font-size:16px">SHRI FRAGRANCE</span><br/>
      <span style="color:#e8c98a;font-size:10px;letter-spacing:3px">SACRED TEMPLE AGARBATHI</span>
    </div>
    <div style="padding:24px;color:#3a2a2a;font-size:14px;line-height:1.6">#BODY#</div>
    <div style="background:#FFF8E7;padding:14px 24px;text-align:center;color:#8a7a5a;font-size:11px">
      Handcrafted with devotion · +91 98765 43210 · info@shrifragrance.com
    </div>
  </div>`

function wrap(body: string): string {
  return BRAND.replace('#BODY#', body)
}

function itemsTable(order: MailOrderView): string {
  const rows = order.items
    .map(
      (it) => `<tr>
        <td style="padding:6px 0">${escapeHtml(it.name)} × ${it.quantity}</td>
        <td style="padding:6px 0;text-align:right">₹${it.price * it.quantity}</td>
      </tr>`,
    )
    .join('')
  return `<table style="width:100%;border-collapse:collapse;font-size:13px">
    <tr><td colspan="2" style="border-bottom:1px solid #e5d9b8;padding-bottom:6px;font-weight:bold">Items</td></tr>
    ${rows}
    <tr><td style="padding-top:8px;font-weight:bold">Total</td>
        <td style="padding-top:8px;text-align:right;font-weight:bold">₹${order.total}</td></tr>
  </table>`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function addressLine(order: MailOrderView): string {
  const s = order.shipment
  if (!s?.address) return ''
  return `${[s.address, s.city, s.state, s.pincode].filter(Boolean).join(', ')}`
}

// ── Public senders (all best-effort) ──────────────────────────────────────

/** Customer: order confirmation. */
export async function sendOrderConfirmation(order: MailOrderView): Promise<void> {
  const to = order.customer?.email
  if (!to || !(await isEmailConfigured())) return
  try {
    await send(
      to,
      `Order ${order.id} confirmed — Shri Fragrance`,
      wrap(`
        <p>Vanakkam${order.customer?.name ? ` ${escapeHtml(order.customer.name)}` : ''},</p>
        <p>Your order <strong>${escapeHtml(order.id)}</strong> has been confirmed and is being prepared with care.</p>
        ${itemsTable(order)}
        ${addressLine(order) ? `<p style="margin-top:16px"><strong>Delivering to:</strong><br/>${escapeHtml(addressLine(order))}</p>` : ''}
        <p style="margin-top:16px">We'll email you tracking details as soon as your parcel ships.</p>`),
      `Order ${order.id} confirmed. Total ₹${order.total}. We'll email tracking when it ships.`,
    )
  } catch (e) {
    console.warn(`[email] confirmation for ${order.id} failed:`, (e as Error).message)
  }
}

/** Owner/admin: new order alert. */
export async function sendOwnerNewOrderAlert(order: MailOrderView): Promise<void> {
  const t = await getTransport()
  if (!t) return
  try {
    await send(
      t.cfg.ownerEmail || 'admin@shrifragrance.com',
      `New order ${order.id} — ₹${order.total}`,
      wrap(`
        <p><strong>New order received</strong></p>
        ${itemsTable(order)}
        <p style="margin-top:16px"><strong>Customer:</strong><br/>
          ${escapeHtml(order.customer?.name || '—')}<br/>
          ${escapeHtml(order.customer?.email || '—')} · ${escapeHtml(order.customer?.phone || '—')}
        </p>
        ${addressLine(order) ? `<p><strong>Ship to:</strong><br/>${escapeHtml(addressLine(order))}</p>` : ''}
        <p style="margin-top:16px">Manage it in the admin dashboard → Orders.</p>`),
      `New order ${order.id}, ₹${order.total}, from ${order.customer?.name || order.customer?.email || 'customer'}.`,
    )
  } catch (e) {
    console.warn(`[email] owner alert for ${order.id} failed:`, (e as Error).message)
  }
}

/** Customer: your order has shipped (with courier/AWB when available). */
export async function sendShippingNotification(order: MailOrderView): Promise<void> {
  const to = order.customer?.email
  if (!to || !(await isEmailConfigured())) return
  const t = (await getTransport())!
  const trackLink = `${(t.cfg.siteUrl || '').replace(/\/+$/, '')}/dashboard`
  try {
    await send(
      to,
      `Your order ${order.id} has shipped — Shri Fragrance`,
      wrap(`
        <p>Vanakkam${order.customer?.name ? ` ${escapeHtml(order.customer.name)}` : ''},</p>
        <p>Good news — your order <strong>${escapeHtml(order.id)}</strong> is on its way.</p>
        <p>
          ${order.shipping?.courierName ? `<strong>Courier:</strong> ${escapeHtml(order.shipping.courierName)}<br/>` : ''}
          ${order.shipping?.awbCode ? `<strong>Tracking no:</strong> ${escapeHtml(order.shipping.awbCode)}<br/>` : ''}
        </p>
        <p style="margin:16px 0">
          <a href="${trackLink}" style="background:#D4722A;color:#fff;padding:10px 22px;border-radius:20px;
             text-decoration:none;font-weight:bold;display:inline-block">Track your order</a>
        </p>
        <p style="font-size:12px;color:#8a7a5a">You can also track it anytime from our site → My Orders.</p>`),
      `Your order ${order.id} has shipped${order.shipping?.awbCode ? ` (tracking ${order.shipping.awbCode})`.trim() : ''}. Track it at ${trackLink}`,
    )
  } catch (e) {
    console.warn(`[email] shipping notice for ${order.id} failed:`, (e as Error).message)
  }
}

// Keep nodemailer in the server bundle only.
export type { Transporter }
