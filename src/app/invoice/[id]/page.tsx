'use client'

// Printable tax invoice for a single order. Fetched by order id with the
// signed-in session (cookie) — the API only returns the order to its owner
// or an admin. Print / save-as-PDF via the browser dialog.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { Flame, Printer, ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface InvoiceOrder {
  id: string
  date?: string
  createdAt?: number
  status?: string
  payment?: string
  total?: number
  items?: Array<{ id?: number; name?: string; quantity?: number; price?: number }>
  customer?: { name?: string; email?: string; phone?: string }
  shipment?: { address?: string; city?: string; state?: string; pincode?: string }
}

const STORE = {
  name: 'Shri Fragrance',
  tagline: 'Sacred South Indian Agarbathi & Pooja Essentials',
  address: 'Shri Fragrance, Tamil Nadu, India',
  phone: '+91 98765 43210',
  email: 'info@shrifragrance.com',
  gstin: '33XXXXXXXXXXX', // ← replace with the real GSTIN before printing for filing
}

const fmt = (n: number) => `₹${n.toLocaleString('en-IN')}`

export default function InvoicePage() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const [order, setOrder] = useState<InvoiceOrder | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    void (async () => {
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(id)}`)
        const data = (await res.json()) as { ok: boolean; order?: InvoiceOrder; error?: string }
        if (!res.ok || !data.ok || !data.order) {
          setError(
            res.status === 401
              ? 'Please sign in to view this invoice.'
              : data.error || 'Invoice not found.',
          )
          return
        }
        setOrder(data.order)
      } catch {
        setError('Could not load the invoice. Check your connection.')
      } finally {
        setLoading(false)
      }
    })()
  }, [id])

  const subtotal = (order?.items ?? []).reduce((s, i) => s + (i.price ?? 0) * (i.quantity ?? 0), 0)
  const shipping = Math.max(0, (order?.total ?? 0) - subtotal)
  const invoiceNo = order?.id?.replace('ORD-', 'INV-')

  return (
    <div className="min-h-screen bg-temple-cream/60 py-8 px-4 print:bg-white print:py-0">
      <style>{`@media print { .no-print { display: none !important; } }`}</style>
      <div className="max-w-3xl mx-auto">
        <div className="no-print flex items-center justify-between mb-6">
          <Link href="/dashboard" className="text-sm text-temple-deep/70 hover:text-temple-deep inline-flex items-center gap-1.5">
            <ArrowLeft className="w-4 h-4" /> Back to dashboard
          </Link>
          {order && (
            <Button onClick={() => window.print()} className="bg-temple-deep text-temple-gold hover:bg-temple-maroon gap-2">
              <Printer className="w-4 h-4" /> Print / Save PDF
            </Button>
          )}
        </div>

        {loading && (
          <div className="flex items-center justify-center py-24 text-temple-deep/60">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="bg-white border border-temple-gold/25 rounded-2xl p-8 text-center">
            <p className="text-temple-deep font-semibold">{error}</p>
            <Link href="/login?next=%2Fdashboard" className="text-temple-saffron font-semibold text-sm hover:underline">
              Sign in
            </Link>
          </div>
        )}

        {!loading && order && (
          <div className="bg-white border border-temple-gold/25 rounded-2xl shadow-sm p-8 print:rounded-none print:border-0 print:shadow-none">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-temple-gold/20 pb-6">
              <div className="flex items-center gap-3">
                <span className="w-12 h-12 rounded-full saffron-gradient flex items-center justify-center shadow-md">
                  <Flame className="w-6 h-6 text-white" />
                </span>
                <div>
                  <h1 className="text-xl font-bold text-temple-deep tracking-wide">{STORE.name}</h1>
                  <p className="text-[11px] text-temple-deep/55">{STORE.tagline}</p>
                  <p className="text-[11px] text-temple-deep/55 mt-1">{STORE.address} · {STORE.phone} · {STORE.email}</p>
                  <p className="text-[11px] text-temple-deep/55">GSTIN: {STORE.gstin}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest text-temple-deep/50">Tax Invoice</p>
                <p className="text-lg font-bold text-temple-deep">{invoiceNo}</p>
                <p className="text-xs text-temple-deep/60 mt-1">
                  Date: {order.date || (order.createdAt ? new Date(order.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')}
                </p>
                <p className="text-xs text-temple-deep/60">Order: {order.id}</p>
                <p className="text-xs text-temple-deep/60">
                  Payment: {order.payment === 'upi' ? 'UPI (paid online)' : order.payment === 'card' ? 'Card (paid online)' : 'Paid online'}
                </p>
              </div>
            </div>

            {/* Parties */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-temple-gold/20">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-temple-deep/50 mb-1.5">Billed To</p>
                <p className="text-sm font-bold text-temple-deep">{order.customer?.name || '—'}</p>
                <p className="text-xs text-temple-deep/65 mt-0.5">{order.customer?.email}</p>
                <p className="text-xs text-temple-deep/65">{order.customer?.phone}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-temple-deep/50 mb-1.5">Shipping Address</p>
                <p className="text-xs text-temple-deep/75 leading-relaxed">
                  {[order.shipment?.address, order.shipment?.city, order.shipment?.state, order.shipment?.pincode]
                    .filter(Boolean)
                    .map((line, i) => (
                      <span key={i}>
                        {line}
                        <br />
                      </span>
                    ))}
                </p>
              </div>
            </div>

            {/* Items */}
            <table className="w-full text-sm mt-6">
              <thead>
                <tr className="text-left text-[10px] uppercase tracking-widest text-temple-deep/50 border-b border-temple-gold/20">
                  <th className="py-2 font-semibold">#</th>
                  <th className="py-2 font-semibold">Item</th>
                  <th className="py-2 font-semibold text-center">Qty</th>
                  <th className="py-2 font-semibold text-right">Rate</th>
                  <th className="py-2 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(order.items ?? []).map((it, idx) => (
                  <tr key={it.id ?? idx} className="border-b border-temple-gold/10">
                    <td className="py-2.5 text-temple-deep/60">{idx + 1}</td>
                    <td className="py-2.5 text-temple-deep font-medium">{it.name}</td>
                    <td className="py-2.5 text-center text-temple-deep/75">{it.quantity}</td>
                    <td className="py-2.5 text-right text-temple-deep/75">{fmt(it.price ?? 0)}</td>
                    <td className="py-2.5 text-right text-temple-deep font-semibold">{fmt((it.price ?? 0) * (it.quantity ?? 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="flex justify-end mt-6">
              <div className="w-full sm:w-72 space-y-1.5 text-sm">
                <div className="flex justify-between text-temple-deep/75">
                  <span>Subtotal</span>
                  <span>{fmt(subtotal)}</span>
                </div>
                <div className="flex justify-between text-temple-deep/75">
                  <span>Shipping</span>
                  <span>{fmt(shipping)}</span>
                </div>
                <div className="flex justify-between border-t border-temple-gold/25 pt-2 text-base font-bold text-temple-deep">
                  <span>Total</span>
                  <span>{fmt(order.total ?? 0)}</span>
                </div>
              </div>
            </div>

            <p className="text-[11px] text-temple-deep/50 text-center mt-8 pt-4 border-t border-temple-gold/20">
              Thank you for your order. This is a computer-generated invoice. · Status: {order.status || '—'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
