'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, Search, Star, ShoppingCart, Eye, Heart, Sparkles,
  FlameKindling, Filter, SlidersHorizontal, Package, X, Check, Flame
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Dialog, DialogContent, DialogTitle, DialogDescription
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { addToStoredCart, type CartLine } from '@/lib/cart'
import { loadAdminCatalog, fetchCatalog } from '@/lib/catalog'
import { fetchWishlist, toggleWishlist as toggleWishlistBackend } from '@/lib/wishlist'

interface CollectionProduct {
  id: number
  name: string
  subtitle?: string
  fragrance?: string
  description?: string
  price: number
  originalPrice?: number
  image: string
  category: string
  badge?: string
  badgeColor?: string
  rating: number
  reviews?: number
  stock?: number
  source: 'admin'
}

// Curated catalog mirrors the homepage hero collection so the dedicated
// /collection view is fully populated even before admin adds products.

// Parse "₹1,890" → 1890. Admin stores price as a string.
function parsePrice(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return 0
  const n = parseInt(value.replace(/[^\d]/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

function loadAdminProducts(): CollectionProduct[] {
  try {
    return loadAdminCatalog().map((p) => ({
      id: 2000 + (p.id ?? 0),
      name: p.name ?? 'Unnamed',
      subtitle: p.category ?? 'Catalog',
      price: parsePrice(p.price),
      image: p.image || '',
      category: p.category || 'Others',
      badge: p.status && p.status !== 'Active' ? p.status : 'Available',
      badgeColor: p.status === 'Low Stock'
        ? 'bg-amber-500 text-white'
        : p.status === 'Out of Stock'
        ? 'bg-red-500 text-white'
        : 'bg-temple-gold text-white',
      rating: p.rating ?? 4.5,
      reviews: p.sales ?? 0,
      stock: p.stock,
      source: 'admin' as const,
    }))
  } catch {
    return []
  }
}

type SortKey = 'featured' | 'price-asc' | 'price-desc' | 'rating'

export default function CollectionPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [adminProducts, setAdminProducts] = useState<CollectionProduct[]>([])
  const [hydrated, setHydrated] = useState(false)
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('featured')
  const [wishlist, setWishlist] = useState<number[]>([])
  const [quickView, setQuickView] = useState<CollectionProduct | null>(null)
  const [justAdded, setJustAdded] = useState<number | null>(null)

  useEffect(() => {
    setAdminProducts(loadAdminProducts())
    setHydrated(true)
    let active = true
    void fetchCatalog().then(() => { if (active) setAdminProducts(loadAdminProducts()) })
    return () => { active = false }
  }, [])

  // Wishlist ids loaded from the backend (Firestore, cached locally).
  useEffect(() => {
    let active = true
    void fetchWishlist().then((items) => {
      if (active) setWishlist(items.map((i) => i.id))
    })
    return () => { active = false }
  }, [])

  const allProducts = useMemo<CollectionProduct[]>(
    () => adminProducts,
    [adminProducts],
  )

  const categories = useMemo(() => {
    const set = new Set<string>(['All'])
    for (const p of allProducts) set.add(p.category)
    return Array.from(set)
  }, [allProducts])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    let list = allProducts.filter((p) => {
      const matchCategory = activeCategory === 'All' || p.category === activeCategory
      const matchSearch = !term
        || p.name.toLowerCase().includes(term)
        || (p.fragrance ?? '').toLowerCase().includes(term)
        || (p.subtitle ?? '').toLowerCase().includes(term)
      return matchCategory && matchSearch
    })
    if (sort === 'price-asc') list = [...list].sort((a, b) => a.price - b.price)
    else if (sort === 'price-desc') list = [...list].sort((a, b) => b.price - a.price)
    else if (sort === 'rating') list = [...list].sort((a, b) => b.rating - a.rating)
    return list
  }, [allProducts, activeCategory, search, sort])

  const handleAddToCart = useCallback((p: CollectionProduct) => {
    if (!p.price) {
      toast({ title: 'Price unavailable', description: 'This product has no price set.' })
      return
    }
    const line: CartLine = {
      id: p.id,
      name: p.name,
      price: p.price,
      image: p.image || '/images/product1.png',
      quantity: 1,
    }
    addToStoredCart([line])
    setJustAdded(p.id)
    setTimeout(() => setJustAdded((curr) => (curr === p.id ? null : curr)), 1400)
    toast({ title: 'Added to cart', description: `${p.name} added.` })
  }, [toast])

  const toggleWishlist = useCallback((p: CollectionProduct) => {
    const next = toggleWishlistBackend({
      id: p.id,
      name: p.name,
      price: p.price,
      originalPrice: p.originalPrice ?? p.price,
      image: p.image || '',
    })
    setWishlist(next.map((i) => i.id))
  }, [])

  return (
    <div className="min-h-screen bg-temple-cream">
      {/* ===== Header ===== */}
      <header className="sticky top-0 z-40 bg-temple-cream/95 backdrop-blur border-b border-temple-gold/15">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 text-temple-deep font-semibold">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Home</span>
          </Link>
          <h1 className="hidden sm:block text-lg font-bold text-temple-deep tracking-wide">
            Sacred Collection
          </h1>
          <Link href="/cart" className="text-xs sm:text-sm font-medium text-temple-saffron hover:text-temple-deep transition-colors flex items-center gap-1">
            <ShoppingCart className="w-3.5 h-3.5" /> View Cart
          </Link>
        </div>
      </header>

      {/* ===== Hero / Banner ===== */}
      <section className="relative overflow-hidden border-b border-temple-gold/15 bg-gradient-to-br from-temple-cream via-white to-temple-cream">
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, var(--temple-gold, #C5972E) 0, transparent 40%), radial-gradient(circle at 80% 60%, var(--temple-saffron, #D4722A) 0, transparent 40%)',
          }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14 text-center">
          <Badge className="bg-temple-gold/15 text-temple-deep border-temple-gold/25 mb-3">
            <Sparkles className="w-3 h-3 mr-1" /> Curated for Devotees
          </Badge>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-temple-deep mb-3">
            Explore the <span className="text-temple-saffron">Sacred</span> Collection
          </h2>
          <p className="text-sm sm:text-base text-temple-deep/65 max-w-2xl mx-auto">
            Handcrafted agarbathis, dhoop and pooja essentials — filter by category, search by fragrance,
            and add your favourites to the cart in a tap.
          </p>
          <div className="mt-5 flex flex-wrap gap-3 justify-center text-[11px] text-temple-deep/60">
            <span className="px-3 py-1 rounded-full border border-temple-gold/25 bg-white">
              {allProducts.length} products
            </span>
            <span className="px-3 py-1 rounded-full border border-temple-gold/25 bg-white">
              {categories.length - 1} categories
            </span>
            {hydrated && adminProducts.length === 0 && (
              <span className="px-3 py-1 rounded-full border border-temple-saffron/30 bg-temple-saffron/5 text-temple-saffron">
                No products yet — add some from /admin
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ===== Filter bar ===== */}
      <section className="sticky top-16 z-30 bg-temple-cream/95 backdrop-blur border-b border-temple-gold/15">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-temple-deep/40" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or fragrance..."
                className="pl-9 h-10 border-temple-gold/25 bg-white focus:border-temple-saffron"
              />
            </div>
            <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
              <SelectTrigger className="sm:w-56 h-10 border-temple-gold/25 bg-white">
                <SlidersHorizontal className="w-3.5 h-3.5 mr-1 text-temple-deep/50" />
                <SelectValue placeholder="Sort" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="featured">Featured</SelectItem>
                <SelectItem value="price-asc">Price: Low → High</SelectItem>
                <SelectItem value="price-desc">Price: High → Low</SelectItem>
                <SelectItem value="rating">Top Rated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Tabs value={activeCategory} onValueChange={setActiveCategory}>
            <TabsList className="flex w-full justify-start flex-nowrap overflow-x-auto h-auto gap-1.5 bg-white/70 border border-temple-gold/15 p-1.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {categories.map((cat) => (
                <TabsTrigger
                  key={cat}
                  value={cat}
                  className="shrink-0 data-[state=active]:bg-temple-saffron data-[state=active]:text-white data-[state=active]:shadow data-[state=active]:shadow-temple-saffron/25 text-xs px-4 py-2 min-h-[36px] rounded-md transition-all"
                >
                  <Filter className="w-3 h-3 mr-1 opacity-60" />
                  {cat}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </section>

      {/* ===== Product grid ===== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-5 flex items-center justify-between">
          <p className="text-sm text-temple-deep/60">
            Showing <span className="font-semibold text-temple-deep">{visible.length}</span>
            {' '}of {allProducts.length} products
            {activeCategory !== 'All' && (
              <> in <span className="font-semibold text-temple-saffron">{activeCategory}</span></>
            )}
          </p>
          {(search || activeCategory !== 'All') && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-temple-deep/60 hover:text-temple-deep"
              onClick={() => { setSearch(''); setActiveCategory('All') }}
            >
              <X className="w-3 h-3 mr-1" /> Reset filters
            </Button>
          )}
        </div>

        {visible.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-temple-gold/25 rounded-xl bg-white/60">
            <Package className="w-10 h-10 text-temple-gold/30 mx-auto mb-3" />
            <p className="text-temple-deep/60 text-sm">No products match your filter.</p>
            <Button
              variant="link"
              className="text-temple-saffron mt-1"
              onClick={() => { setSearch(''); setActiveCategory('All') }}
            >
              Show all products
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {visible.map((p) => {
              const isWished = wishlist.includes(p.id)
              const discount = p.originalPrice
                ? Math.round(((p.originalPrice - p.price) / p.originalPrice) * 100)
                : 0
              return (
                <Card
                  key={p.id}
                  onClick={() => setQuickView(p)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      setQuickView(p)
                    }
                  }}
                  className="group relative overflow-hidden border-temple-gold/15 bg-white transition-all hover:shadow-xl hover:shadow-temple-deep/10 hover:-translate-y-0.5 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-temple-saffron/60"
                >
                  <div className="relative aspect-square bg-gradient-to-b from-temple-cream/40 to-white p-5 overflow-hidden">
                    {p.image ? (
                      <img
                        src={p.image}
                        alt={p.name}
                        loading="lazy"
                        className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-temple-gold/30">
                        <Package className="w-16 h-16" />
                      </div>
                    )}

                    {p.badge && (
                      <Badge className={`absolute top-3 left-3 text-[10px] px-2 py-0.5 shadow-sm ${p.badgeColor ?? 'bg-temple-gold text-white'}`}>
                        {p.badge}
                      </Badge>
                    )}
                    {discount > 0 && (
                      <Badge className="absolute top-3 right-3 bg-temple-deep text-white text-[10px] px-2 py-0.5 shadow-sm">
                        -{discount}%
                      </Badge>
                    )}

                    <div className="absolute bottom-3 right-3 flex flex-col gap-2 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-9 w-9 rounded-full bg-white/95 shadow-md hover:bg-white"
                        onClick={(e) => { e.stopPropagation(); toggleWishlist(p) }}
                        aria-label="Wishlist"
                      >
                        <Heart className={`w-4 h-4 ${isWished ? 'fill-red-500 text-red-500' : ''}`} />
                      </Button>
                    </div>

                    {/* Click-to-view hint */}
                    <div className="absolute inset-x-0 bottom-0 px-4 py-2 bg-gradient-to-t from-temple-deep/85 via-temple-deep/60 to-transparent text-[10px] tracking-wider font-semibold text-temple-gold uppercase opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
                      <Eye className="w-3 h-3" /> Tap to view details
                    </div>
                  </div>

                  <CardContent className="p-4">
                    <div className="flex items-center gap-0.5 mb-1.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className={`w-3 h-3 ${i < Math.floor(p.rating) ? 'fill-temple-amber text-temple-amber' : 'text-temple-gold/20'}`}
                        />
                      ))}
                      {!!p.reviews && (
                        <span className="text-[10px] text-temple-gold/60 ml-1">({p.reviews})</span>
                      )}
                    </div>
                    <h3 className="font-bold text-temple-deep text-sm leading-tight line-clamp-2">
                      {p.name}
                    </h3>
                    {p.subtitle && (
                      <p className="text-[11px] text-temple-gold/60 mt-0.5">{p.subtitle}</p>
                    )}
                    {p.fragrance && (
                      <p className="text-[11px] text-temple-saffron/75 flex items-center gap-1 mt-1">
                        <FlameKindling className="w-3 h-3" /> {p.fragrance}
                      </p>
                    )}
                    <div className="flex items-baseline gap-2 mt-3">
                      <span className="text-lg font-bold text-temple-deep">₹{p.price}</span>
                      {p.originalPrice && (
                        <span className="text-xs text-temple-gold/40 line-through">₹{p.originalPrice}</span>
                      )}
                    </div>
                  </CardContent>

                  <CardFooter className="p-4 pt-0 flex gap-2">
                    <Button
                      onClick={(e) => { e.stopPropagation(); handleAddToCart(p) }}
                      className="flex-1 bg-temple-deep text-temple-gold hover:bg-temple-maroon border border-temple-gold/30 font-semibold text-xs h-10 transition-all shadow-md shadow-temple-deep/20"
                      size="sm"
                    >
                      {justAdded === p.id ? (
                        <><Check className="w-3.5 h-3.5 mr-1.5" /> Added</>
                      ) : (
                        <><ShoppingCart className="w-3.5 h-3.5 mr-1.5" /> Add to Cart</>
                      )}
                    </Button>
                    <Button
                      onClick={(e) => { e.stopPropagation(); handleAddToCart(p); router.push('/checkout') }}
                      className="flex-1 saffron-gradient text-white hover:brightness-110 font-semibold text-xs h-10 shadow-md shadow-temple-saffron/25"
                      size="sm"
                    >
                      <Flame className="w-3.5 h-3.5 mr-1.5" /> Buy Now
                    </Button>
                  </CardFooter>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {/* ===== Quick view dialog ===== */}
      <Dialog open={!!quickView} onOpenChange={(open) => !open && setQuickView(null)}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          {quickView && (
            <div className="grid grid-cols-1 md:grid-cols-2">
              <div className="bg-gradient-to-b from-temple-cream/60 to-white p-8 flex items-center justify-center">
                {quickView.image ? (
                  <img src={quickView.image} alt={quickView.name} className="max-h-72 object-contain" />
                ) : (
                  <Package className="w-24 h-24 text-temple-gold/30" />
                )}
              </div>
              <div className="p-6">
                <DialogTitle className="text-xl font-bold text-temple-deep">{quickView.name}</DialogTitle>
                <DialogDescription className="text-temple-gold/70 mt-1">
                  {quickView.subtitle || quickView.category}
                </DialogDescription>

                <div className="flex items-center gap-0.5 mt-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`w-3.5 h-3.5 ${i < Math.floor(quickView.rating) ? 'fill-temple-amber text-temple-amber' : 'text-temple-gold/20'}`} />
                  ))}
                  {!!quickView.reviews && (
                    <span className="text-xs text-temple-gold/60 ml-1.5">{quickView.reviews} reviews</span>
                  )}
                </div>

                {quickView.fragrance && (
                  <p className="text-sm text-temple-saffron/80 flex items-center gap-1 mt-3">
                    <FlameKindling className="w-3.5 h-3.5" /> {quickView.fragrance}
                  </p>
                )}

                {quickView.description && (
                  <p className="text-sm text-temple-deep/70 leading-relaxed mt-3">
                    {quickView.description}
                  </p>
                )}

                <div className="flex items-baseline gap-3 mt-5">
                  <span className="text-3xl font-bold text-temple-deep">₹{quickView.price}</span>
                  {quickView.originalPrice && (
                    <span className="text-sm text-temple-gold/40 line-through">₹{quickView.originalPrice}</span>
                  )}
                </div>

                <div className="mt-6 flex flex-col sm:flex-row gap-2">
                  <Button
                    onClick={() => { handleAddToCart(quickView); setQuickView(null) }}
                    className="flex-1 bg-temple-deep text-temple-gold hover:bg-temple-maroon border border-temple-gold/30 font-semibold h-11"
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" /> Add to Cart
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => toggleWishlist(quickView)}
                    className="border-temple-gold/25 h-11"
                  >
                    <Heart className={`w-4 h-4 ${wishlist.includes(quickView.id) ? 'fill-red-500 text-red-500' : ''}`} />
                  </Button>
                </div>

                <p className="text-[11px] text-temple-deep/50 mt-4">
                  Category: <span className="font-medium text-temple-deep/70">{quickView.category}</span>
                  {typeof quickView.stock === 'number' && (
                    <> · Stock: <span className="font-medium text-temple-deep/70">{quickView.stock}</span></>
                  )}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
