'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, ShoppingBag, Trash2, Plus, Minus, ShieldCheck, Truck,
  RotateCcw, Sparkles, ChevronRight, Tag, Flame, Heart,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { loadCart, saveCart, addLine, fetchCart, type CartLine } from '@/lib/cart'

export default function CartPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [items, setItems] = useState<CartLine[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [promo, setPromo] = useState('')
  const [promoApplied, setPromoApplied] = useState(false)

  useEffect(() => {
    setItems(loadCart())
    setHydrated(true)
    let active = true
    fetchCart().then(items => { if (active) setItems(items) })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (hydrated) saveCart(items)
  }, [items, hydrated])

  const updateQty = useCallback((id: number, delta: number) => {
    setItems(prev =>
      prev
        .map(i => (i.id === id ? { ...i, quantity: i.quantity + delta } : i))
        .filter(i => i.quantity > 0),
    )
  }, [])

  const removeItem = useCallback((id: number) => {
    setItems(prev => prev.filter(i => i.id !== id))
    toast({ title: 'Removed from cart' })
  }, [toast])

  const moveToWishlist = useCallback((id: number) => {
    try {
      const raw = localStorage.getItem('shri:wishlist')
      const list = raw ? (JSON.parse(raw) as number[]) : []
      if (!list.includes(id)) {
        localStorage.setItem('shri:wishlist', JSON.stringify([...list, id]))
      }
    } catch {}
    removeItem(id)
    toast({ title: 'Moved to wishlist' })
  }, [removeItem, toast])

  const applyPromo = useCallback(() => {
    if (promo.trim().toUpperCase() === 'TEMPLE10') {
      setPromoApplied(true)
      toast({ title: 'Promo applied', description: '10% off your order!' })
    } else if (promo.trim() === '') {
      toast({ title: 'Enter a code first' })
    } else {
      toast({ title: 'Invalid code', description: 'Try TEMPLE10 for 10% off.' })
    }
  }, [promo, toast])

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + i.price * i.quantity, 0),
    [items],
  )
  const shipping = subtotal === 0 ? 0 : subtotal >= 499 ? 0 : 49
  const promoDiscount = promoApplied ? Math.round(subtotal * 0.1) : 0
  const total = Math.max(0, subtotal + shipping - promoDiscount)
  const totalCount = items.reduce((s, i) => s + i.quantity, 0)

  // SSR/static-export guard so the cart count doesn't mismatch hydration.
  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-temple-cream">
        <div className="w-10 h-10 rounded-full border-4 border-temple-saffron border-t-transparent animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-temple-cream">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-temple-gold/15">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 text-temple-deep font-semibold">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Continue Shopping</span>
          </Link>
          <h1 className="hidden sm:block text-lg font-bold text-temple-deep">
            Your Cart {totalCount > 0 && <span className="text-temple-saffron">({totalCount})</span>}
          </h1>
          <Link href="/collection" className="text-xs sm:text-sm font-medium text-temple-saffron hover:text-temple-deep transition-colors">
            Browse Collection →
          </Link>
        </div>
      </header>

      {items.length === 0 ? (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-20 text-center">
          <div className="w-24 h-24 rounded-full bg-temple-gold/10 flex items-center justify-center mx-auto mb-6">
            <ShoppingBag className="w-12 h-12 text-temple-gold/50" />
          </div>
          <h2 className="text-2xl font-bold text-temple-deep mb-2">Your cart is empty</h2>
          <p className="text-sm text-temple-deep/60 mb-6">
            Discover sacred fragrances handcrafted from temple traditions.
          </p>
          <Link href="/collection">
            <Button className="bg-temple-deep text-temple-gold hover:bg-temple-maroon border border-temple-gold/30 font-semibold px-8 h-11">
              <Sparkles className="w-4 h-4 mr-2" /> Explore Collection
            </Button>
          </Link>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8">
            {/* ITEMS */}
            <section className="space-y-4">
              <div className="bg-white rounded-2xl border border-temple-gold/15 shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-temple-gold/10 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-temple-deep">
                    Shopping Cart <span className="text-sm font-normal text-temple-deep/55">— {totalCount} {totalCount === 1 ? 'item' : 'items'}</span>
                  </h2>
                  <span className="text-xs text-temple-deep/55 hidden sm:block">Prices include all taxes</span>
                </div>

                <ul className="divide-y divide-temple-gold/10">
                  {items.map(item => (
                    <li key={item.id} className="p-4 sm:p-6 flex flex-col sm:flex-row gap-4 group">
                      <div className="w-full sm:w-32 h-32 shrink-0 rounded-xl bg-gradient-to-b from-temple-cream/60 to-white p-3 border border-temple-gold/10 flex items-center justify-center">
                        <img src={item.image} alt={item.name} className="max-h-full max-w-full object-contain" loading="lazy" />
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col sm:flex-row gap-4">
                        <div className="flex-1 min-w-0">
                          <h3 className="text-base font-bold text-temple-deep line-clamp-2">{item.name}</h3>
                          <p className="text-xs text-temple-gold/70 mt-0.5 flex items-center gap-1">
                            <Flame className="w-3 h-3" /> Temple Grade · In stock
                          </p>
                          <p className="text-lg font-bold text-temple-deep mt-3">₹{item.price}</p>

                          {/* Qty + Actions */}
                          <div className="mt-4 flex flex-wrap items-center gap-3">
                            <div className="inline-flex items-center rounded-full border border-temple-gold/25 bg-white overflow-hidden">
                              <button onClick={() => updateQty(item.id, -1)}
                                className="w-9 h-9 flex items-center justify-center text-temple-deep hover:bg-temple-gold/5 transition-colors disabled:opacity-40"
                                disabled={item.quantity <= 1}
                                aria-label="Decrease quantity">
                                <Minus className="w-3.5 h-3.5" />
                              </button>
                              <span className="w-10 text-center text-sm font-semibold text-temple-deep">{item.quantity}</span>
                              <button onClick={() => updateQty(item.id, 1)}
                                className="w-9 h-9 flex items-center justify-center text-temple-deep hover:bg-temple-gold/5 transition-colors"
                                aria-label="Increase quantity">
                                <Plus className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <button onClick={() => moveToWishlist(item.id)}
                              className="text-xs font-medium text-temple-deep/70 hover:text-temple-saffron flex items-center gap-1 transition-colors">
                              <Heart className="w-3.5 h-3.5" /> Save for later
                            </button>
                            <button onClick={() => removeItem(item.id)}
                              className="text-xs font-medium text-red-500/80 hover:text-red-600 flex items-center gap-1 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" /> Remove
                            </button>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-[10px] uppercase tracking-wider text-temple-deep/50">Total</p>
                          <p className="text-xl font-bold text-temple-deep">₹{item.price * item.quantity}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Reassurance row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { icon: Truck, title: 'Free Shipping', desc: 'On orders above ₹499' },
                  { icon: RotateCcw, title: '7-Day Returns', desc: 'Hassle-free returns' },
                  { icon: ShieldCheck, title: '100% Authentic', desc: 'Handcrafted in India' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-3.5 rounded-xl bg-white border border-temple-gold/12">
                    <span className="w-9 h-9 rounded-full bg-temple-saffron/10 text-temple-saffron flex items-center justify-center shrink-0">
                      <item.icon className="w-4 h-4" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-temple-deep">{item.title}</p>
                      <p className="text-[10px] text-temple-deep/55">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* SUMMARY */}
            <aside className="lg:sticky lg:top-24 h-fit space-y-4">
              <div className="bg-white rounded-2xl border border-temple-gold/15 shadow-sm p-5">
                <h2 className="text-base font-bold text-temple-deep mb-4">Order Summary</h2>

                {/* Promo */}
                <div className="mb-4">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-temple-deep/40" />
                      <Input
                        value={promo}
                        onChange={e => { setPromo(e.target.value); setPromoApplied(false) }}
                        placeholder="Promo code"
                        className="pl-8 h-10 border-temple-gold/25 text-sm"
                      />
                    </div>
                    <Button variant="outline" onClick={applyPromo}
                      className="h-10 px-4 border-temple-gold/30 text-temple-deep hover:bg-temple-gold/5 text-sm font-semibold">
                      Apply
                    </Button>
                  </div>
                  {promoApplied && (
                    <p className="mt-2 text-[11px] text-emerald-600 font-medium">✓ TEMPLE10 applied — 10% off</p>
                  )}
                  {!promoApplied && (
                    <p className="mt-2 text-[10px] text-temple-deep/45">Try <code className="text-temple-saffron font-semibold">TEMPLE10</code> for 10% off</p>
                  )}
                </div>

                <Separator className="bg-temple-gold/10" />

                <div className="space-y-2.5 py-4 text-sm">
                  <div className="flex justify-between text-temple-deep/75">
                    <span>Subtotal ({totalCount} {totalCount === 1 ? 'item' : 'items'})</span>
                    <span>₹{subtotal}</span>
                  </div>
                  <div className="flex justify-between text-temple-deep/75">
                    <span>Shipping</span>
                    <span>{shipping === 0 ? <span className="text-emerald-600 font-semibold">FREE</span> : `₹${shipping}`}</span>
                  </div>
                  {promoApplied && (
                    <div className="flex justify-between text-emerald-600 font-medium">
                      <span>Promo discount</span>
                      <span>− ₹{promoDiscount}</span>
                    </div>
                  )}
                </div>

                <Separator className="bg-temple-gold/10" />

                <div className="flex justify-between items-baseline py-4">
                  <span className="text-base font-bold text-temple-deep">Total</span>
                  <span className="text-2xl font-bold text-temple-deep">₹{total}</span>
                </div>

                <Button onClick={() => router.push('/checkout')}
                  className="w-full bg-temple-deep text-temple-gold hover:bg-temple-maroon border border-temple-gold/30 font-bold h-12 text-sm shadow-lg shadow-temple-deep/20">
                  Proceed to Checkout <ChevronRight className="w-4 h-4 ml-1" />
                </Button>

                {subtotal < 499 && (
                  <p className="mt-3 text-[11px] text-center text-temple-saffron">
                    Add ₹{499 - subtotal} more for <span className="font-bold">free shipping</span>
                  </p>
                )}

                <div className="mt-4 flex items-center justify-center gap-1.5 text-[10px] text-temple-deep/45">
                  <ShieldCheck className="w-3 h-3" /> Safe & Secure Payment · 256-bit SSL
                </div>
              </div>
            </aside>
          </div>
        </div>
      )}
    </div>
  )
}
