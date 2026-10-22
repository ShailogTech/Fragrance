'use client'

import { useEffect, useMemo, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, User, Truck, Wallet, CheckCircle2, Mail, Phone, MapPin,
  ShieldCheck, ChevronRight, CreditCard, IndianRupee, Smartphone, Banknote,
  Flame, Lock, Check, Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { loadCart, saveCart, fetchCart, type CartLine } from '@/lib/cart'
import { addOrder } from '@/lib/orders'
import { getSession, subscribeAuth, type Session } from '@/lib/auth'

type Step = 'address' | 'payment' | 'review' | 'confirmation'

const STEPS: { key: Step; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'address', label: 'Address', icon: Truck },
  { key: 'payment', label: 'Payment', icon: Wallet },
  { key: 'review', label: 'Review', icon: CheckCircle2 },
]

type PayMethod = 'cod' | 'upi' | 'card'

export default function CheckoutPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [hydrated, setHydrated] = useState(false)
  const [items, setItems] = useState<CartLine[]>([])
  const [step, setStep] = useState<Step>('address')
  const [orderId, setOrderId] = useState<string | null>(null)
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    setItems(loadCart())
    setHydrated(true)
    let active = true
    fetchCart().then(items => { if (active) setItems(items) })
    const refresh = () => setSession(getSession())
    refresh()
    const unsub = subscribeAuth(refresh)
    return () => { active = false; unsub() }
  }, [])

  const [form, setForm] = useState({
    name: '', email: '', phone: '',
    address: '', city: '', state: '', pincode: '', notes: '',
    method: 'standard' as 'standard' | 'express',
    payment: 'cod' as PayMethod,
    upiId: '',
    cardName: '', cardNumber: '', cardExpiry: '', cardCvv: '',
  })

  // Pre-fill from session + saved profile.
  useEffect(() => {
    let name = session?.name ?? ''
    let email = session?.email ?? ''
    let phone = ''
    try {
      const raw = localStorage.getItem('shri:profile')
      if (raw) {
        const saved = JSON.parse(raw) as { name?: string; email?: string; phone?: string }
        name = saved.name ?? name
        email = saved.email ?? email
        phone = saved.phone ?? phone
      }
    } catch {}
    setForm(prev => ({ ...prev, name, email, phone }))
  }, [session])

  const subtotal = useMemo(() => items.reduce((s, i) => s + i.price * i.quantity, 0), [items])
  const shippingFee = items.length === 0
    ? 0
    : form.method === 'express'
    ? 99
    : subtotal >= 499
    ? 0
    : 49
  const total = subtotal + shippingFee
  const totalCount = items.reduce((s, i) => s + i.quantity, 0)

  const goNext = useCallback(() => {
    if (step === 'address') {
      const f = form
      if (!f.name.trim() || !f.email.trim() || !f.phone.trim()) {
        toast({ title: 'Customer details required', description: 'Please fill in name, email and phone.' })
        return
      }
      if (!f.address.trim() || !f.city.trim() || !f.state.trim() || !f.pincode.trim()) {
        toast({ title: 'Shipping address required', description: 'Please complete the delivery address.' })
        return
      }
      setStep('payment')
    } else if (step === 'payment') {
      if (form.payment === 'upi' && !form.upiId.trim()) {
        toast({ title: 'Enter UPI ID' })
        return
      }
      if (form.payment === 'card' && (!form.cardNumber.trim() || !form.cardName.trim())) {
        toast({ title: 'Enter card details' })
        return
      }
      setStep('review')
    }
  }, [step, form, toast])

  const placeOrder = useCallback(() => {
    if (items.length === 0) return
    const customer = { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim() }
    const shipment = {
      address: form.address.trim(), city: form.city.trim(), state: form.state.trim(),
      pincode: form.pincode.trim(), notes: form.notes.trim() || undefined, method: form.method,
    }
    const order = addOrder(items, total, { customer, shipment })
    setOrderId(order.id)
    setStep('confirmation')
    setItems([])
    saveCart([])
    toast({ title: 'Order placed', description: `Order ${order.id} confirmed!` })
  }, [items, form, total, toast])

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-temple-cream">
        <div className="w-10 h-10 rounded-full border-4 border-temple-saffron border-t-transparent animate-spin" />
      </div>
    )
  }

  // Empty-cart guard (but not in confirmation view)
  if (items.length === 0 && step !== 'confirmation') {
    return (
      <div className="min-h-screen bg-temple-cream">
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-temple-gold/15">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-temple-deep font-semibold">
              <ArrowLeft className="w-4 h-4" /> <span className="text-sm">Back</span>
            </Link>
            <h1 className="text-lg font-bold text-temple-deep">Checkout</h1>
            <span />
          </div>
        </header>
        <div className="max-w-2xl mx-auto px-4 py-20 text-center">
          <h2 className="text-2xl font-bold text-temple-deep mb-2">Nothing to checkout</h2>
          <p className="text-sm text-temple-deep/60 mb-6">Your cart is empty. Add a few sacred fragrances first.</p>
          <Link href="/collection">
            <Button className="bg-temple-deep text-temple-gold hover:bg-temple-maroon border border-temple-gold/30 font-semibold px-8 h-11">
              <Sparkles className="w-4 h-4 mr-2" /> Explore Collection
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-temple-cream">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-temple-gold/15">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/cart" className="flex items-center gap-2 text-temple-deep font-semibold">
            <ArrowLeft className="w-4 h-4" /> <span className="text-sm hidden sm:inline">Back to Cart</span>
          </Link>
          <h1 className="text-lg font-bold text-temple-deep flex items-center gap-2">
            <Lock className="w-4 h-4 text-temple-saffron" />
            Secure Checkout
          </h1>
          <span className="text-xs text-temple-deep/55 hidden sm:block flex items-center gap-1">
            <ShieldCheck className="w-3 h-3" /> 256-bit SSL
          </span>
        </div>
      </header>

      {/* Confirmation step is a full-width centred view */}
      {step === 'confirmation' && orderId ? (
        <ConfirmationView orderId={orderId} customer={form} total={total} method={form.method} payment={form.payment} />
      ) : (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          {/* Stepper */}
          <Stepper current={step} />

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 mt-8">
            {/* LEFT: forms by step */}
            <section className="space-y-6">
              {step === 'address' && (
                <AddressStep form={form} setForm={setForm} />
              )}
              {step === 'payment' && (
                <PaymentStep form={form} setForm={setForm} total={total} />
              )}
              {step === 'review' && (
                <ReviewStep form={form} items={items} total={total} subtotal={subtotal} shippingFee={shippingFee} />
              )}

              <div className="flex flex-col sm:flex-row gap-3 justify-between">
                {step !== 'address' && (
                  <Button variant="outline"
                    onClick={() => setStep(step === 'payment' ? 'address' : 'payment')}
                    className="border-temple-gold/25 h-11">
                    <ArrowLeft className="w-4 h-4 mr-1" /> Back
                  </Button>
                )}
                {step !== 'review' ? (
                  <Button onClick={goNext}
                    className="sm:ml-auto h-11 bg-temple-deep text-temple-gold hover:bg-temple-maroon border border-temple-gold/30 font-bold px-8">
                    Continue <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                ) : (
                  <Button onClick={placeOrder}
                    className="sm:ml-auto h-11 saffron-gradient text-white hover:brightness-110 font-bold px-8 shadow-lg shadow-temple-saffron/25">
                    <Check className="w-4 h-4 mr-2" /> Place Order — ₹{total}
                  </Button>
                )}
              </div>
            </section>

            {/* RIGHT: Summary */}
            <aside className="lg:sticky lg:top-24 h-fit">
              <div className="bg-white rounded-2xl border border-temple-gold/15 shadow-sm p-5">
                <h2 className="text-base font-bold text-temple-deep mb-4 flex items-center gap-2">
                  <Flame className="w-4 h-4 text-temple-saffron" /> Order Summary
                </h2>
                <ul className="space-y-3 max-h-56 overflow-y-auto pr-1">
                  {items.map(it => (
                    <li key={it.id} className="flex gap-3">
                      <div className="w-14 h-14 rounded-lg bg-temple-cream/60 border border-temple-gold/10 p-1.5 flex items-center justify-center shrink-0">
                        <img src={it.image} alt={it.name} className="max-h-full max-w-full object-contain" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-temple-deep truncate">{it.name}</p>
                        <p className="text-[10px] text-temple-deep/55">Qty: {it.quantity}</p>
                      </div>
                      <p className="text-xs font-bold text-temple-deep shrink-0">₹{it.price * it.quantity}</p>
                    </li>
                  ))}
                </ul>

                <Separator className="bg-temple-gold/10 my-4" />

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-temple-deep/75">
                    <span>Subtotal ({totalCount})</span><span>₹{subtotal}</span>
                  </div>
                  <div className="flex justify-between text-temple-deep/75">
                    <span>Shipping</span>
                    <span>{shippingFee === 0 ? <span className="text-emerald-600 font-semibold">FREE</span> : `₹${shippingFee}`}</span>
                  </div>
                </div>

                <Separator className="bg-temple-gold/10 my-4" />

                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-bold text-temple-deep">Total</span>
                  <span className="text-xl font-bold text-temple-deep">₹{total}</span>
                </div>

                <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-temple-deep/45">
                  <Lock className="w-3 h-3" /> Encrypted & secure
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}
    </div>
  )
}

// ───────────────────────── components ─────────────────────────

function Stepper({ current }: { current: Step }) {
  const idx = STEPS.findIndex(s => s.key === current)
  const safeIdx = idx === -1 ? STEPS.length - 1 : idx
  return (
    <ol className="flex items-center justify-center gap-1 sm:gap-3 max-w-2xl mx-auto">
      {STEPS.map((s, i) => {
        const done = i < safeIdx
        const active = i === safeIdx
        return (
          <li key={s.key} className="flex items-center gap-1 sm:gap-3">
            <div className="flex items-center gap-2">
              <span className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                done ? 'bg-emerald-500 text-white' :
                active ? 'bg-temple-saffron text-white shadow-lg shadow-temple-saffron/30 scale-110' :
                'bg-temple-gold/15 text-temple-deep/40'
              }`}>
                {done ? <Check className="w-4 h-4" /> : <s.icon className="w-4 h-4" />}
              </span>
              <span className={`text-xs sm:text-sm font-semibold ${active ? 'text-temple-deep' : 'text-temple-deep/45'}`}>
                {s.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <span className={`hidden sm:block w-12 h-px ${done ? 'bg-emerald-500' : 'bg-temple-gold/20'}`} />
            )}
          </li>
        )
      })}
    </ol>
  )
}

function AddressStep({ form, setForm }: { form: any; setForm: any }) {
  return (
    <>
      <Section icon={User} title="Contact Information">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input placeholder="Full name *" value={form.name}
            onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))}
            className="h-11 border-temple-gold/25 sm:col-span-2" />
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-temple-deep/40" />
            <Input type="email" placeholder="Email *" value={form.email}
              onChange={e => setForm((f: any) => ({ ...f, email: e.target.value }))}
              className="pl-9 h-11 border-temple-gold/25" />
          </div>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-temple-deep/40" />
            <Input type="tel" placeholder="Phone *" value={form.phone}
              onChange={e => setForm((f: any) => ({ ...f, phone: e.target.value }))}
              className="pl-9 h-11 border-temple-gold/25" />
          </div>
        </div>
      </Section>

      <Section icon={Truck} title="Shipping Address">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-3 relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-temple-deep/40" />
            <Input placeholder="Street address, apartment, etc. *" value={form.address}
              onChange={e => setForm((f: any) => ({ ...f, address: e.target.value }))}
              className="pl-9 h-11 border-temple-gold/25" />
          </div>
          <Input placeholder="City *" value={form.city}
            onChange={e => setForm((f: any) => ({ ...f, city: e.target.value }))}
            className="h-11 border-temple-gold/25" />
          <Input placeholder="State *" value={form.state}
            onChange={e => setForm((f: any) => ({ ...f, state: e.target.value }))}
            className="h-11 border-temple-gold/25" />
          <Input placeholder="Pincode *" value={form.pincode}
            onChange={e => setForm((f: any) => ({ ...f, pincode: e.target.value }))}
            className="h-11 border-temple-gold/25" />
          <Input placeholder="Delivery notes (optional)" value={form.notes}
            onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))}
            className="h-11 border-temple-gold/25 sm:col-span-3" />
        </div>

        <div className="mt-4">
          <p className="text-xs font-semibold text-temple-deep/70 mb-2">Delivery Speed</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { v: 'standard' as const, label: 'Standard', sub: '3–5 business days', fee: 'Free on ₹499+' },
              { v: 'express' as const, label: 'Express', sub: '1–2 business days', fee: '₹99' },
            ].map(opt => (
              <button key={opt.v} type="button" onClick={() => setForm((f: any) => ({ ...f, method: opt.v }))}
                className={`p-3.5 rounded-xl border text-left transition-all ${form.method === opt.v
                  ? 'border-temple-saffron bg-temple-saffron/10 ring-1 ring-temple-saffron/40 shadow-sm'
                  : 'border-temple-gold/15 bg-white hover:border-temple-gold/35'}`}>
                <p className="text-sm font-bold text-temple-deep">{opt.label}</p>
                <p className="text-[11px] text-temple-deep/55 mt-0.5">{opt.sub}</p>
                <p className="text-[11px] text-temple-saffron font-semibold mt-1">{opt.fee}</p>
              </button>
            ))}
          </div>
        </div>
      </Section>
    </>
  )
}

function PaymentStep({ form, setForm, total }: { form: any; setForm: any; total: number }) {
  const methods: { v: PayMethod; label: string; icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
    { v: 'cod', label: 'Cash on Delivery', icon: Banknote, desc: 'Pay in cash when your order arrives' },
    { v: 'upi', label: 'UPI', icon: Smartphone, desc: 'PhonePe, Google Pay, Paytm and more' },
    { v: 'card', label: 'Credit / Debit Card', icon: CreditCard, desc: 'Visa, Mastercard, RuPay' },
  ]
  return (
    <Section icon={Wallet} title="Payment Method">
      <div className="space-y-3">
        {methods.map(m => {
          const active = form.payment === m.v
          return (
            <button key={m.v} type="button" onClick={() => setForm((f: any) => ({ ...f, payment: m.v }))}
              className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-3 ${active
                ? 'border-temple-saffron bg-temple-saffron/10 ring-1 ring-temple-saffron/40'
                : 'border-temple-gold/15 bg-white hover:border-temple-gold/35'}`}>
              <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${active ? 'bg-temple-saffron text-white' : 'bg-temple-gold/10 text-temple-saffron'}`}>
                <m.icon className="w-5 h-5" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-bold text-temple-deep">{m.label}</p>
                <p className="text-[11px] text-temple-deep/55">{m.desc}</p>
              </div>
              <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${active ? 'border-temple-saffron bg-temple-saffron' : 'border-temple-gold/25'}`}>
                {active && <span className="w-1.5 h-1.5 bg-white rounded-full" />}
              </span>
            </button>
          )
        })}
      </div>

      {form.payment === 'upi' && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-temple-deep/70 mb-2">UPI ID</p>
          <Input placeholder="yourname@upi" value={form.upiId}
            onChange={e => setForm((f: any) => ({ ...f, upiId: e.target.value }))}
            className="h-11 border-temple-gold/25" />
        </div>
      )}
      {form.payment === 'card' && (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input placeholder="Name on card" value={form.cardName}
            onChange={e => setForm((f: any) => ({ ...f, cardName: e.target.value }))}
            className="h-11 border-temple-gold/25 sm:col-span-2" />
          <Input placeholder="Card number" inputMode="numeric" value={form.cardNumber}
            onChange={e => setForm((f: any) => ({ ...f, cardNumber: e.target.value }))}
            className="h-11 border-temple-gold/25 sm:col-span-2" />
          <Input placeholder="MM/YY" value={form.cardExpiry}
            onChange={e => setForm((f: any) => ({ ...f, cardExpiry: e.target.value }))}
            className="h-11 border-temple-gold/25" />
          <Input placeholder="CVV" inputMode="numeric" value={form.cardCvv}
            onChange={e => setForm((f: any) => ({ ...f, cardCvv: e.target.value }))}
            className="h-11 border-temple-gold/25" />
        </div>
      )}

      <p className="mt-4 text-[11px] text-temple-deep/50 flex items-center gap-1.5">
        <ShieldCheck className="w-3 h-3 text-emerald-600" /> Payments are encrypted and never stored.
      </p>

      <p className="mt-2 text-[11px] text-temple-deep/50">
        Amount to pay: <span className="font-bold text-temple-deep">₹{total}</span>
      </p>
    </Section>
  )
}

function ReviewStep({ form, items, total, subtotal, shippingFee }: {
  form: any; items: CartLine[]; total: number; subtotal: number; shippingFee: number
}) {
  return (
    <>
      <Section icon={User} title="Contact & Shipping" titleAction={null}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-temple-deep/45 mb-1">Customer</p>
            <p className="text-sm font-semibold text-temple-deep">{form.name}</p>
            <p className="text-xs text-temple-deep/65 mt-0.5">{form.email}</p>
            <p className="text-xs text-temple-deep/65">{form.phone}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-temple-deep/45 mb-1">Shipping to</p>
            <p className="text-sm text-temple-deep">{form.address}</p>
            <p className="text-xs text-temple-deep/65">{form.city}, {form.state} — {form.pincode}</p>
            <p className="text-[11px] text-temple-saffron font-semibold mt-1 uppercase tracking-wider">
              {form.method === 'express' ? 'Express • 1–2 days' : 'Standard • 3–5 days'}
            </p>
          </div>
        </div>
      </Section>

      <Section icon={Wallet} title="Payment">
        <p className="text-sm font-semibold text-temple-deep">
          {form.payment === 'cod' && 'Cash on Delivery'}
          {form.payment === 'upi' && `UPI · ${form.upiId || '—'}`}
          {form.payment === 'card' && `Card ending ${form.cardNumber.slice(-4) || '••••'}`}
        </p>
      </Section>

      <Section icon={Flame} title="Items">
        <ul className="space-y-3">
          {items.map(it => (
            <li key={it.id} className="flex gap-3 p-2.5 rounded-lg bg-temple-cream/40">
              <div className="w-14 h-14 rounded-md bg-white p-1.5 border border-temple-gold/10 flex items-center justify-center shrink-0">
                <img src={it.image} alt={it.name} className="max-h-full max-w-full object-contain" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-temple-deep">{it.name}</p>
                <p className="text-[11px] text-temple-deep/55">Qty: {it.quantity} × ₹{it.price}</p>
              </div>
              <p className="text-sm font-bold text-temple-deep">₹{it.quantity * it.price}</p>
            </li>
          ))}
        </ul>
        <Separator className="bg-temple-gold/10 my-3" />
        <div className="space-y-1 text-xs">
          <div className="flex justify-between text-temple-deep/75"><span>Subtotal</span><span>₹{subtotal}</span></div>
          <div className="flex justify-between text-temple-deep/75"><span>Shipping</span><span>{shippingFee === 0 ? 'FREE' : `₹${shippingFee}`}</span></div>
          <div className="flex justify-between font-bold text-temple-deep text-sm pt-2 border-t border-temple-gold/15 mt-2">
            <span>Total</span><span>₹{total}</span>
          </div>
        </div>
      </Section>
    </>
  )
}

function Section({
  icon: Icon, title, titleAction, children,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  titleAction?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-2xl border border-temple-gold/15 shadow-sm">
      <div className="px-5 sm:px-6 py-4 border-b border-temple-gold/10 flex items-center justify-between">
        <h2 className="text-base font-bold text-temple-deep flex items-center gap-2">
          <Icon className="w-4 h-4 text-temple-saffron" /> {title}
        </h2>
        {titleAction}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </div>
  )
}

function ConfirmationView({
  orderId, customer, total, method, payment,
}: {
  orderId: string
  customer: { name: string; email: string; phone: string; address: string; city: string; state: string; pincode: string; notes?: string }
  total: number
  method: string
  payment: PayMethod
}) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      <div className="bg-white rounded-3xl border border-temple-gold/15 shadow-xl shadow-temple-deep/5 p-8 sm:p-12 text-center">
        <div className="w-20 h-20 rounded-full saffron-gradient flex items-center justify-center mx-auto mb-5 animate-glow shadow-2xl shadow-temple-saffron/30">
          <Check className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-temple-deep">Thank you for your order!</h1>
        <p className="text-sm text-temple-deep/65 mt-2">
          Order <span className="font-bold text-temple-deep">{orderId}</span> has been confirmed.
          We&apos;ll email you the receipt and tracking details shortly.
        </p>

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
          <div className="p-4 rounded-xl bg-temple-cream/60 border border-temple-gold/15">
            <p className="text-[10px] font-bold uppercase tracking-wider text-temple-saffron mb-2 flex items-center gap-1">
              <User className="w-3 h-3" /> Customer
            </p>
            <p className="text-sm font-semibold text-temple-deep">{customer.name}</p>
            <p className="text-xs text-temple-deep/65 mt-0.5 flex items-center gap-1"><Mail className="w-3 h-3" /> {customer.email}</p>
            <p className="text-xs text-temple-deep/65 mt-0.5 flex items-center gap-1"><Phone className="w-3 h-3" /> {customer.phone}</p>
          </div>
          <div className="p-4 rounded-xl bg-temple-cream/60 border border-temple-gold/15">
            <p className="text-[10px] font-bold uppercase tracking-wider text-temple-saffron mb-2 flex items-center gap-1">
              <Truck className="w-3 h-3" /> Shipping to
            </p>
            <p className="text-sm text-temple-deep">{customer.address}</p>
            <p className="text-xs text-temple-deep/65 mt-0.5">{customer.city}, {customer.state} — {customer.pincode}</p>
            <p className="text-[11px] text-temple-saffron font-semibold uppercase tracking-wider mt-1">
              {method === 'express' ? 'Express • 1–2 days' : 'Standard • 3–5 days'}
            </p>
          </div>
        </div>

        <div className="mt-5 p-4 rounded-xl bg-temple-deep text-temple-gold flex items-center justify-between">
          <span className="text-sm font-semibold flex items-center gap-2">
            <IndianRupee className="w-4 h-4" />
            {payment === 'cod' ? 'Cash on Delivery' : payment === 'upi' ? 'Paid via UPI' : 'Paid via Card'}
          </span>
          <span className="text-xl font-bold">₹{total}</span>
        </div>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/dashboard" className="flex-1">
            <Button variant="outline" className="w-full h-11 border-temple-gold/30">
              View My Orders
            </Button>
          </Link>
          <Link href="/collection" className="flex-1">
            <Button className="w-full h-11 bg-temple-deep text-temple-gold hover:bg-temple-maroon border border-temple-gold/30 font-semibold">
              <Sparkles className="w-4 h-4 mr-2" /> Continue Shopping
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
