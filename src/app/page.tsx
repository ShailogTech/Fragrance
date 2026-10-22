'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Flame, ShoppingCart, Heart, Star, Search, Menu, X, Minus, Plus,
  MapPin, Phone, Mail, ChevronRight, Truck, Shield, Award,
  Sparkles, Lamp, Flower2, Sun, Eye, Share2, Check, ArrowUp,
  Gem, FlameKindling, CircleDot, User, BookOpen, ChevronDown
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogTitle, DialogDescription
} from '@/components/ui/dialog'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter
} from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { loadCart, saveCart, fetchCart, type CartLine } from '@/lib/cart'
import { addOrder } from '@/lib/orders'
import { fetchWishlist, toggleWishlist as toggleWishlistBackend, type WishEntry } from '@/lib/wishlist'
import { ensureAdminSeed, getSession, logout as authLogout, subscribeAuth, type Session } from '@/lib/auth'
import { loadAdminCatalog, fetchCatalog } from '@/lib/catalog'
import { LogOut, LogIn } from 'lucide-react'

// ====== TYPES ======
interface Product {
  id: number
  name: string
  subtitle: string
  fragrance: string
  description?: string
  price: number
  originalPrice: number
  image: string
  category: string
  badge: string
  badgeColor: string
  rating: number
  reviews: number
}

interface CartItem extends Product {
  quantity: number
}

// ====== DATA ======

// Read the admin-managed catalog from localStorage and shape it into the
// homepage Product type. Returns an empty array on the server so SSR/CSR match.
function parsePriceToNumber(value: unknown): number {
  if (typeof value === 'number') return value
  if (typeof value !== 'string') return 0
  const n = parseInt(value.replace(/[^\d]/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}
function loadAdminProducts(): Product[] {
  return loadAdminCatalog().map((p) => {
    const price = parsePriceToNumber(p.price)
    const badge =
      p.status === 'Out of Stock' ? 'Out of Stock' :
      p.status === 'Low Stock' ? 'Low Stock' :
      'Available'
    const badgeColor =
      p.status === 'Out of Stock' ? 'bg-red-500 text-white' :
      p.status === 'Low Stock' ? 'bg-amber-500 text-white' :
      'bg-temple-saffron text-white'
    return {
      id: p.id,
      name: p.name,
      subtitle: p.category ?? 'Catalog',
      fragrance: p.category ?? '',
      price,
      originalPrice: Math.max(price, Math.round(price * 1.35)),
      image: p.image || '/images/product1.png',
      category: p.category || 'Others',
      badge,
      badgeColor,
      rating: p.rating ?? 4.5,
      reviews: p.sales ?? 0,
    }
  })
}

const testimonials = [
  {
    name: 'Priya Venkatesh', location: 'Chennai, Tamil Nadu',
    rating: 5, text: 'The Chandanam Sandalwood agarbathi reminds me of my visits to Tirupati temple. The fragrance is absolutely divine and fills our entire pooja room with sacred aroma.',
    avatar: 'PV'
  },
  {
    name: 'Rajesh Iyer', location: 'Bangalore, Karnataka',
    rating: 5, text: 'We have been using Shri Fragrance products for our daily pooja for over 10 years. The quality has remained consistently excellent. The Nag Champa is our family favorite.',
    avatar: 'RI'
  },
  {
    name: 'Lakshmi Sharma', location: 'Hyderabad, Telangana',
    rating: 5, text: 'The Sambrani Herbal incense has become essential for our evening aarti. The natural fragrance purifies the entire home. My grandmother approves!',
    avatar: 'LS'
  }
]

const trustBadges = [
  { icon: Truck, title: 'Free Delivery', desc: 'On orders above ₹499' },
  { icon: Shield, title: '100% Natural', desc: 'No chemicals or additives' },
  { icon: Award, title: 'Temple Trusted', desc: 'Used in 500+ temples' },
  { icon: Sparkles, title: 'Handcrafted', desc: 'Traditional methods' }
]

const poojaSteps = [
  { step: 1, title: 'Prepare', desc: 'Clean the pooja room and arrange the altar with flowers and sacred items', icon: Sparkles },
  { step: 2, title: 'Light', desc: 'Light the agarbathi and diya to invite divine presence and purify the space', icon: Flame },
  { step: 3, title: 'Offer', desc: 'Present flowers, naivedyam, and sacred water with devotion and reverence', icon: Flower2 },
  { step: 4, title: 'Chant', desc: 'Recite mantras and stotrams to connect with the divine consciousness', icon: BookOpen },
  { step: 5, title: 'Meditate', desc: 'Sit in silence, absorb the sacred fragrance, and experience inner peace', icon: Sun }
]

// ====== ANIMATED COUNTER ======
function AnimatedCounter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [count, setCount] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const hasAnimated = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !hasAnimated.current) {
        hasAnimated.current = true
        let start = 0
        const duration = 1500
        const step = (timestamp: number) => {
          if (!start) start = timestamp
          const progress = Math.min((timestamp - start) / duration, 1)
          setCount(Math.floor(progress * target))
          if (progress < 1) requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
      }
    }, { threshold: 0.3 })
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target])

  return <div ref={ref}>{count}{suffix}</div>
}

// Round computed SVG coords to a fixed precision so server and client
// serialize identical attribute strings (prevents hydration mismatch).
const svgCoord = (n: number) => Math.round(n * 1000) / 1000

// ====== KOLAM SVG PATTERN ======
function KolamPattern({ className = '' }: { className?: string }) {
  return (
    <svg className={`opacity-[0.04] ${className}`} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="80" stroke="#C5972E" strokeWidth="0.5" />
      <circle cx="100" cy="100" r="60" stroke="#C5972E" strokeWidth="0.5" />
      <circle cx="100" cy="100" r="40" stroke="#C5972E" strokeWidth="0.5" />
      <circle cx="100" cy="100" r="20" stroke="#C5972E" strokeWidth="0.5" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map(angle => (
        <line key={angle}
          x1="100" y1="100"
          x2={svgCoord(100 + 80 * Math.cos((angle * Math.PI) / 180))}
          y2={svgCoord(100 + 80 * Math.sin((angle * Math.PI) / 180))}
          stroke="#C5972E" strokeWidth="0.5" />
      ))}
      {[0, 45, 90, 135].map(angle => (
        <circle key={`d${angle}`}
          cx={svgCoord(100 + 70 * Math.cos((angle * Math.PI) / 180))}
          cy={svgCoord(100 + 70 * Math.sin((angle * Math.PI) / 180))}
          r="4" fill="#C5972E" />
      ))}
    </svg>
  )
}

// ====== MANDALA SPIN ======
function MandalaSpin({ size = 120, className = '' }: { size?: number; className?: string }) {
  return (
    <div className={`animate-mandala ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <circle cx="60" cy="60" r="55" stroke="url(#mandalaGold)" strokeWidth="0.5" />
        <circle cx="60" cy="60" r="45" stroke="url(#mandalaGold)" strokeWidth="0.5" />
        <circle cx="60" cy="60" r="35" stroke="url(#mandalaGold)" strokeWidth="0.5" />
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(angle => (
          <line key={angle} x1="60" y1="60"
            x2={svgCoord(60 + 55 * Math.cos((angle * Math.PI) / 180))}
            y2={svgCoord(60 + 55 * Math.sin((angle * Math.PI) / 180))}
            stroke="#C5972E" strokeWidth="0.3" />
        ))}
        {[0, 60, 120, 180, 240, 300].map(angle => (
          <circle key={`p${angle}`}
            cx={svgCoord(60 + 50 * Math.cos((angle * Math.PI) / 180))}
            cy={svgCoord(60 + 50 * Math.sin((angle * Math.PI) / 180))}
            r="3" fill="#C5972E" opacity="0.5" />
        ))}
        <circle cx="60" cy="60" r="8" fill="#C5972E" opacity="0.3" />
        <defs>
          <linearGradient id="mandalaGold" x1="0" y1="0" x2="120" y2="120">
            <stop offset="0%" stopColor="#C5972E" />
            <stop offset="50%" stopColor="#FFD700" />
            <stop offset="100%" stopColor="#C5972E" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}

// ====== TEMPLE BELL SVG ======
function TempleBell({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-bell ${className}`} style={{ transformOrigin: 'top center' }}>
      <svg viewBox="0 0 40 60" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <rect x="18" y="0" width="4" height="8" fill="#C5972E" />
        <path d="M8 45 Q8 20 20 12 Q32 20 32 45 Z" fill="url(#bellGrad)" stroke="#B8860B" strokeWidth="0.5" />
        <ellipse cx="20" cy="46" rx="14" ry="4" fill="#C5972E" />
        <circle cx="20" cy="50" r="3" fill="#D4722A" />
        <defs>
          <linearGradient id="bellGrad" x1="8" y1="12" x2="32" y2="45">
            <stop offset="0%" stopColor="#FFD700" />
            <stop offset="50%" stopColor="#C5972E" />
            <stop offset="100%" stopColor="#B8860B" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}

// ====== DIYA SVG ======
function DiyaFlame({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <div className={`animate-diya ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        {/* Flame */}
        <ellipse cx="16" cy="10" rx="4" ry="8" fill="url(#flameGrad)" opacity="0.9" />
        <ellipse cx="16" cy="12" rx="2" ry="5" fill="#FFD700" opacity="0.8" />
        {/* Diya bowl */}
        <path d="M6 22 Q6 18 16 18 Q26 18 26 22 L24 28 Q24 30 16 30 Q8 30 8 28 Z" fill="url(#diyaGrad)" />
        <ellipse cx="16" cy="22" rx="10" ry="3" fill="#D4722A" />
        <defs>
          <linearGradient id="flameGrad" x1="12" y1="2" x2="20" y2="18">
            <stop offset="0%" stopColor="#FF6F00" />
            <stop offset="40%" stopColor="#FFD700" />
            <stop offset="100%" stopColor="#FFBF00" />
          </linearGradient>
          <linearGradient id="diyaGrad" x1="6" y1="18" x2="26" y2="30">
            <stop offset="0%" stopColor="#C5972E" />
            <stop offset="100%" stopColor="#8B6914" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}

// ====== LOTUS SVG ======
function LotusIcon({ size = 40, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} style={{ width: size, height: size }}>
      {/* Petals */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => (
        <ellipse key={i}
          cx="20" cy="12" rx="4" ry="10"
          fill={i % 2 === 0 ? '#C5972E' : '#D4722A'}
          opacity={i % 2 === 0 ? 0.6 : 0.4}
          transform={`rotate(${angle} 20 20)`}
        />
      ))}
      {/* Center */}
      <circle cx="20" cy="20" r="5" fill="#FFD700" opacity="0.8" />
      <circle cx="20" cy="20" r="3" fill="#FFBF00" />
    </svg>
  )
}

// ====== ORNAMENTAL DIVIDER ======
function OrnamentalDivider({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-3 py-4 ${className}`}>
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-temple-gold/30 to-temple-gold/50" />
      <DiyaFlame size={20} />
      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-temple-gold/30 to-temple-gold/50" />
    </div>
  )
}

// ====== MAIN COMPONENT ======
export default function Home() {
  const { toast } = useToast()
  const router = useRouter()

  const [session, setSession] = useState<Session | null>(null)
  useEffect(() => {
    ensureAdminSeed()
    const refresh = () => setSession(getSession())
    refresh()
    return subscribeAuth(refresh)
  }, [])
  const handleAuthLogout = useCallback(() => {
    authLogout()
    toast({ title: 'Signed out', description: 'See you again soon.' })
  }, [toast])

  const [cart, setCart] = useState<CartItem[]>([])
  const cartHydrated = useRef(false)
  const [wishlist, setWishlist] = useState<number[]>([])

  // Wishlist is backed by Firestore (cached locally); we keep just the ids in
  // state for fast "is this wished?" checks. Re-fetched on auth change.
  useEffect(() => {
    let active = true
    const load = async () => {
      const items = await fetchWishlist()
      if (active) setWishlist(items.map(i => i.id))
    }
    void load()
    const unsub = subscribeAuth(() => { void load() })
    return () => { active = false; unsub() }
  }, [])

  // Load the shared cart: instant from the local cache, then reconciled with
  // the backend (and re-synced whenever the auth session changes).
  useEffect(() => {
    setCart(loadCart() as CartItem[])
    cartHydrated.current = true
    let active = true
    const sync = async () => {
      const items = await fetchCart()
      if (active) setCart(items as CartItem[])
    }
    void sync()
    const unsub = subscribeAuth(() => { void sync() })
    return () => { active = false; unsub() }
  }, [])

  useEffect(() => {
    if (!cartHydrated.current) return
    saveCart(cart as CartLine[])
  }, [cart])
  const [activeCategory, setActiveCategory] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [email, setEmail] = useState('')
  // Catalog comes from the admin panel only (shri:admin:products localStorage).
  // Empty on SSR + first render so hydration matches; populated after mount.
  const [products, setProducts] = useState<Product[]>([])
  useEffect(() => {
    const refresh = () => setProducts(loadAdminProducts())
    refresh()
    void fetchCatalog().then(() => refresh()) // pull catalog from the backend
    window.addEventListener('storage', refresh)
    return () => window.removeEventListener('storage', refresh)
  }, [])

  // Scroll detection with throttling
  useEffect(() => {
    let ticking = false
    const handleScroll = () => {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(() => {
          setShowScrollTop(window.scrollY > 500)
          const scrollTop = window.scrollY
          const docHeight = document.documentElement.scrollHeight - window.innerHeight
          const progress = docHeight > 0 ? scrollTop / docHeight : 0
          document.documentElement.style.setProperty('--scroll-progress', `${progress * 100}%`)
          ticking = false
        })
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // IntersectionObserver for section reveals. A MutationObserver watches
  // for nodes added later (e.g. product cards rendered after the catalog
  // loads) and attaches the IntersectionObserver to them too.
  useEffect(() => {
    const selectors = ['section[id]', '.reveal-up', '.reveal-left', '.reveal-right', '.reveal-scale']
    const selectorList = selectors.join(',')

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) entry.target.classList.add('revealed')
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' },
    )

    const observe = (root: ParentNode) => {
      root.querySelectorAll(selectorList).forEach(el => io.observe(el))
    }
    observe(document)

    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((node) => {
          if (node.nodeType === 1) {
            const el = node as Element
            if (el.matches?.(selectorList)) io.observe(el)
            observe(el)
          }
        })
      }
    })
    mo.observe(document.body, { childList: true, subtree: true })

    return () => { io.disconnect(); mo.disconnect() }
  }, [])

  // Cart functions
  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id)
      if (existing) {
        return prev.map(item =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        )
      }
      return [...prev, { ...product, quantity: 1 }]
    })
    toast({
      title: 'Added to Cart',
      description: `${product.name} — view your cart to checkout`,
    })
  }, [toast])

  const addPoojaSet = useCallback(() => {
    const bundle: Product = {
      id: 999,
      name: 'Complete Pooja Collection',
      subtitle: 'Festive Bundle • 40% Off',
      fragrance: 'Curated set of sacred fragrances',
      description: 'A handpicked festive bundle of our most beloved temple fragrances — perfect for daily pooja and special celebrations.',
      price: 1499,
      originalPrice: 2499,
      image: '/images/product3.png',
      category: 'Premium',
      badge: 'Festive Set',
      badgeColor: 'bg-temple-amber text-temple-deep',
      rating: 4.9,
      reviews: 412,
    }
    addToCart(bundle)
    router.push('/cart')
  }, [addToCart, router])

  const updateQuantity = useCallback((id: number, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + delta
        return newQty > 0 ? { ...item, quantity: newQty } : item
      }
      return item
    }).filter(item => item.quantity > 0))
  }, [])

  const removeFromCart = useCallback((id: number) => {
    setCart(prev => prev.filter(item => item.id !== id))
  }, [])

  const toggleWishlist = useCallback((p: WishEntry) => {
    const next = toggleWishlistBackend(p)
    setWishlist(next.map(i => i.id))
  }, [])

  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0)
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

  const filteredProducts = products.filter(p => {
    const matchCategory = activeCategory === 'All' || p.category === activeCategory
    const matchSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.fragrance.toLowerCase().includes(searchQuery.toLowerCase())
    return matchCategory && matchSearch
  })

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' })

  const handleNewsletterSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (email) {
      toast({ title: 'Subscribed!', description: 'You will receive sacred fragrance updates and offers.' })
      setEmail('')
    }
  }

  return (
    <div className="min-h-screen bg-temple-cream">
      {/* Scroll progress bar */}
      <div className="scroll-progress-bar" />

      {/* ====== HEADER ====== */}
      <header className="sticky top-0 z-50 bg-temple-cream/95 border-b border-temple-gold/15" style={{ backdropFilter: 'blur(12px)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          {/* Top bar */}
          <div className="flex items-center justify-between py-1.5 text-[11px] text-temple-gold/80 border-b border-temple-gold/8">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> +91 98765 43210</span>
              <span className="hidden sm:flex items-center gap-1"><Mail className="w-3 h-3" /> info@shrifragrance.com</span>
            </div>
            <div className="flex items-center gap-1">
              <Flame className="w-3 h-3 animate-diya" />
              <span>Free Delivery on Orders Above ₹499</span>
            </div>
          </div>

          {/* Main nav */}
          <div className="flex items-center justify-between py-3 gap-4">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-3 shrink-0">
              <div className="relative">
                <img src="/images/logo.png" alt="Shri Fragrance Logo" width={44} height={44} className="rounded-full" />
                <div className="absolute -inset-1 rounded-full border border-temple-gold/20 animate-gold-border" />
              </div>
              <div className="hidden sm:block">
                <h1 className="text-lg font-bold tracking-wider gold-text-static">SHRI FRAGRANCE</h1>
                <p className="text-[9px] tracking-[0.2em] text-temple-saffron/80 uppercase">Sacred Temple Agarbathi</p>
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden lg:flex items-center gap-1">
              {[
                { label: 'Home', href: '#home' },
                { label: 'Collections', href: '/collection' },
                { label: 'About', href: '#heritage' },
                { label: 'Pooja Guide', href: '#pooja-guide' },
                { label: 'Contact', href: '#contact' }
              ].map(item => (
                <Link key={item.label} href={item.href}
                  className="px-3 py-2 text-sm font-medium text-temple-deep/80 hover:text-temple-saffron rounded-md hover:bg-temple-gold/5 transition-colors">
                  {item.label}
                </Link>
              ))}
            </nav>

            {/* Right actions */}
            <div className="flex items-center gap-1">
              {showSearch && (
                <Input
                  placeholder="Search fragrances..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-9 w-48 text-sm bg-white/90 border-temple-gold/25"
                  autoFocus
                />
              )}
              <Button variant="ghost" size="icon" onClick={() => { setShowSearch(!showSearch); if (showSearch) setSearchQuery('') }}
                className="text-temple-deep/70 hover:text-temple-saffron h-10 w-10">
                <Search className="w-[18px] h-[18px]" />
              </Button>
              <Link href="/cart">
                <Button variant="ghost" size="icon"
                  className="relative text-temple-deep/70 hover:text-temple-saffron h-10 w-10">
                  <ShoppingCart className="w-[18px] h-[18px]" />
                  {cartCount > 0 && (
                    <Badge className="absolute -top-0.5 -right-0.5 h-4 w-4 flex items-center justify-center p-0 bg-temple-saffron text-white text-[9px] animate-diya">
                      {cartCount}
                    </Badge>
                  )}
                </Button>
              </Link>
              {session ? (
                <>
                  <Link href={session.role === 'admin' ? '/admin' : '/dashboard'} className="hidden sm:block">
                    <Button variant="ghost" size="sm"
                      className="text-temple-deep/80 hover:text-temple-saffron hover:bg-temple-gold/5 gap-2 px-2">
                      <span className="w-7 h-7 rounded-full saffron-gradient text-white text-[11px] font-bold flex items-center justify-center">
                        {session.name.slice(0, 1).toUpperCase()}
                      </span>
                      <span className="text-xs font-medium max-w-[110px] truncate">{session.name.split(' ')[0]}</span>
                    </Button>
                  </Link>
                  <Link href={session.role === 'admin' ? '/admin' : '/dashboard'} className="sm:hidden">
                    <Button variant="ghost" size="icon" className="text-temple-deep/70 hover:text-temple-saffron h-10 w-10">
                      <User className="w-[18px] h-[18px]" />
                    </Button>
                  </Link>
                  <Button variant="ghost" size="icon" onClick={handleAuthLogout} aria-label="Logout"
                    className="text-temple-deep/70 hover:text-temple-saffron h-10 w-10">
                    <LogOut className="w-[18px] h-[18px]" />
                  </Button>
                </>
              ) : (
                <>
                  <Link href="/login" className="hidden sm:block">
                    <Button variant="ghost" size="sm"
                      className="text-temple-deep/80 hover:text-temple-saffron text-xs font-medium">
                      <LogIn className="w-4 h-4 mr-1" /> Sign In
                    </Button>
                  </Link>
                  <Link href="/signup" className="hidden sm:block">
                    <Button size="sm"
                      className="bg-temple-deep text-temple-gold hover:bg-temple-maroon border border-temple-gold/30 text-xs font-semibold">
                      Sign Up
                    </Button>
                  </Link>
                  <Link href="/login" className="sm:hidden">
                    <Button variant="ghost" size="icon" className="text-temple-deep/70 hover:text-temple-saffron h-10 w-10">
                      <User className="w-[18px] h-[18px]" />
                    </Button>
                  </Link>
                </>
              )}
              <Button variant="ghost" size="icon" aria-label="Open menu"
                className="lg:hidden text-temple-deep/70 h-10 w-10"
                onClick={() => setMobileMenuOpen(true)}>
                <Menu className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Mobile Menu Drawer */}
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetContent side="left" className="w-[82%] max-w-sm bg-temple-cream border-r-temple-gold/15 p-0">
              <SheetHeader className="border-b border-temple-gold/12 px-5 py-4">
                <SheetTitle className="flex items-center gap-3 text-temple-deep">
                  <img src="/images/logo.png" alt="Shri Fragrance Logo" width={36} height={36} className="rounded-full" />
                  <span className="text-base font-bold tracking-wider gold-text-static">SHRI FRAGRANCE</span>
                </SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col gap-1 px-3 py-4">
                {[
                  { label: 'Home', href: '#home' },
                  { label: 'Collections', href: '/collection' },
                  { label: 'About', href: '#heritage' },
                  { label: 'Pooja Guide', href: '#pooja-guide' },
                  { label: 'Contact', href: '#contact' }
                ].map(item => (
                  <Link key={item.label} href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center justify-between px-4 py-3.5 text-base font-medium text-temple-deep/85 hover:bg-temple-gold/10 active:bg-temple-gold/15 rounded-lg transition-colors">
                    {item.label}
                    <ChevronRight className="w-4 h-4 opacity-30" />
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main>
        {/* ====== HERO SECTION ====== */}
        <section id="home" className="relative min-h-[92vh] flex items-center overflow-hidden">
          {/* Background image */}
          <div className="absolute inset-0">
            <img src="/images/hero-bg.png" alt="Temple background" className="absolute inset-0 w-full h-full object-cover" loading="eager" />
            <div className="absolute inset-0 bg-gradient-to-br from-temple-maroon/94 via-temple-deep/88 to-temple-maroon/80" />
          </div>

          {/* Kolam pattern overlay */}
          <div className="absolute inset-0 opacity-[0.03]">
            <KolamPattern className="absolute top-10 right-10 w-[300px] h-[300px]" />
            <KolamPattern className="absolute bottom-10 left-10 w-[250px] h-[250px]" />
          </div>

          {/* Floating gold particles */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="gold-particle"
                style={{
                  left: `${15 + i * 15}%`,
                  bottom: `${10 + i * 8}%`,
                  animationDelay: `${i * 0.7}s`,
                  animationDuration: `${4 + i * 0.5}s`
                }} />
            ))}
          </div>

          {/* Mandala decoration */}
          <div className="absolute right-[-80px] top-1/2 -translate-y-1/2 hidden xl:block opacity-[0.06]">
            <MandalaSpin size={400} />
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-16 w-full">
            <div className="max-w-2xl">
              {/* Sacred badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/8 border border-temple-gold/20 mb-8 backdrop-blur-sm">
                <DiyaFlame size={16} />
                <span className="text-xs text-temple-amber/90 font-medium tracking-wide">Sacred Temple Traditions Since 1948</span>
              </div>

              <h2 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white mb-6 leading-[1.08]">
                Shri Agarbathi<br />
                <span className="gold-text">Premium Quality</span><br />
                Sacred Origins
              </h2>

              <p className="text-base sm:text-lg text-white/65 mb-10 max-w-lg leading-relaxed">
                Crafted to capture the sacred ambience, spiritual depth, and timeless fragrance
                traditions of South Indian temples — bringing their serene essence into every moment.
              </p>

              <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3 sm:gap-4 mb-10 sm:mb-16">
                <Button asChild size="lg"
                  className="w-full sm:w-auto saffron-gradient text-white hover:brightness-110 px-8 py-6 text-base sm:text-sm font-semibold shadow-lg shadow-temple-saffron/30 transition-all animate-glow">
                  <a href="#products">
                    <Flame className="w-4 h-4 mr-2" />
                    Explore Collection
                  </a>
                </Button>
                <Button asChild variant="outline" size="lg"
                  className="w-full sm:w-auto border-temple-gold/30 text-white/90 hover:bg-temple-gold/10 hover:border-temple-gold/50 px-8 py-6 text-base sm:text-sm bg-transparent">
                  <a href="#pooja-guide">
                    <Lamp className="w-4 h-4 mr-2" />
                    Pooja Guide
                  </a>
                </Button>
              </div>

              {/* Stats */}
              <div className="flex gap-8 sm:gap-14">
                {[
                  { value: 8, suffix: '', label: 'Sacred Fragrances' },
                  { value: 75, suffix: '+', label: 'Years of Tradition' },
                  { value: 500, suffix: 'K+', label: 'Happy Families' }
                ].map((stat, i) => (
                  <div key={i} className="text-center">
                    <div className="text-2xl sm:text-3xl font-bold gold-text">
                      <AnimatedCounter target={stat.value} suffix={stat.suffix} />
                    </div>
                    <p className="text-[11px] text-white/40 mt-1 tracking-wide">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-temple-gold/40">
            <span className="text-[10px] tracking-[0.3em] uppercase">Scroll</span>
            <div style={{ animation: 'scroll-bounce 2s ease-in-out infinite' }}>
              <ChevronDown className="w-5 h-5" />
            </div>
          </div>
        </section>

        {/* ====== MARQUEE STRIP WITH THORANAM ====== */}
        <div className="relative">
          {/* Thoranam top */}
          <div className="h-3 bg-gradient-to-r from-temple-gold/0 via-temple-gold/80 to-temple-gold/0" />
          <div className="deep-maroon-gradient py-3 overflow-hidden">
            <div className="flex animate-marquee whitespace-nowrap">
              {['Free Delivery on Orders Above ₹499', '100% Natural Ingredients', 'Trusted by 500+ Temples', 'Handcrafted with Devotion', '75+ Years of Sacred Tradition', 'Festive Season Sale - Up to 40% Off',
                'Free Delivery on Orders Above ₹499', '100% Natural Ingredients', 'Trusted by 500+ Temples', 'Handcrafted with Devotion', '75+ Years of Sacred Tradition', 'Festive Season Sale - Up to 40% Off'
              ].map((msg, i) => (
                <span key={i} className="text-temple-amber/90 text-xs font-medium mx-8 flex items-center gap-3">
                  <DiyaFlame size={12} />
                  {msg}
                </span>
              ))}
            </div>
          </div>
          <div className="h-1 bg-gradient-to-r from-temple-gold/0 via-temple-saffron/60 to-temple-gold/0" />
        </div>

        {/* ====== TRUST BADGES ====== */}
        <section className="py-12 bg-white/40 kolam-pattern">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
              {trustBadges.map((badge, i) => (
                <div key={i}
                  className="reveal-scale temple-card bg-white p-6 rounded-xl text-center"
                  style={{ transitionDelay: `${i * 100}ms` }}>
                  <div className="w-14 h-14 rounded-full saffron-gradient flex items-center justify-center mx-auto mb-4 animate-glow">
                    <badge.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="font-bold text-temple-deep text-sm mb-1">{badge.title}</h3>
                  <p className="text-[11px] text-temple-gold/60">{badge.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ====== PRODUCTS SECTION ====== */}
        <section id="products" className="py-16 sm:py-20 bg-temple-cream">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            {/* Section header with thoranam */}
            <div className="text-center mb-12 reveal-up">
              <Badge className="bg-temple-gold/8 text-temple-gold border-temple-gold/15 mb-4">
                <Sparkles className="w-3 h-3 mr-1" /> Sacred Collection
              </Badge>
              <div className="thoranam-arch pt-8">
                <h2 className="text-3xl sm:text-4xl font-bold text-temple-deep mb-3">
                  Our <span className="divine-text">Divine</span> Fragrances
                </h2>
              </div>
              <p className="text-sm text-temple-gold/80 max-w-lg mx-auto mt-4">
                Each agarbathi is handcrafted with sacred ingredients and blessed in temple traditions.
              </p>
            </div>

            {/* Category Tabs */}
            <div className="mb-10 reveal-up">
              <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full">
                <TabsList className="flex w-full sm:w-auto sm:mx-auto justify-start sm:justify-center flex-nowrap overflow-x-auto h-auto gap-1.5 bg-white/60 border border-temple-gold/10 p-1.5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {(['All', ...Array.from(new Set(products.map(p => p.category)))]).map(cat => (
                    <TabsTrigger key={cat} value={cat}
                      style={activeCategory === cat ? {
                        background: 'linear-gradient(135deg, #D4722A 0%, #C5972E 50%, #D4722A 100%)',
                        color: '#fff',
                        boxShadow: '0 4px 12px -2px rgba(212, 114, 42, 0.35)',
                      } : undefined}
                      className="shrink-0 font-medium text-temple-deep/70 hover:text-temple-deep data-[state=active]:text-white text-sm sm:text-xs px-5 py-2.5 min-h-[40px] rounded-lg transition-all">
                      {cat}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((product, idx) => {
                const discount = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
                const isWished = wishlist.includes(product.id)
                return (
                  <div key={product.id} className="reveal-scale" style={{ transitionDelay: `${idx * 80}ms` }}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setQuickViewProduct(product)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setQuickViewProduct(product)
                        }
                      }}
                      className="group temple-card bg-white overflow-hidden cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-temple-saffron/60 transition-all hover:-translate-y-0.5">
                      <div className="relative overflow-hidden">
                        <div className="relative aspect-square bg-gradient-to-b from-temple-cream/60 to-white p-6">
                          <img src={product.image} alt={product.name} loading="lazy"
                            className="object-contain p-4 w-full h-full group-hover:scale-105 transition-transform duration-500" />
                          {/* Incense smoke decoration */}
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 opacity-20">
                            <div className="smoke-trail" style={{ animationDelay: '0s' }} />
                            <div className="smoke-trail" style={{ animationDelay: '1s', left: '4px' }} />
                          </div>
                        </div>
                        <Badge className={`absolute top-3 left-3 ${product.badgeColor} text-[10px] font-semibold px-2.5 py-0.5 shadow-sm`}>
                          {product.badge}
                        </Badge>
                        <Badge className="absolute top-3 right-3 bg-temple-deep text-white text-[10px] px-2.5 py-0.5 shadow-sm animate-gold-border">
                          -{discount}%
                        </Badge>
                        {/* Wishlist quick action */}
                        <div className="absolute bottom-3 right-3 opacity-0 translate-y-3 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300">
                          <Button size="icon" variant="secondary"
                            className="h-9 w-9 rounded-full bg-white/95 shadow-md hover:bg-white"
                            onClick={(e) => { e.stopPropagation(); toggleWishlist({ id: product.id, name: product.name, price: product.price, originalPrice: product.originalPrice, image: product.image }) }}
                            aria-label="Wishlist">
                            <Heart className={`w-4 h-4 ${isWished ? 'fill-red-500 text-red-500' : ''}`} />
                          </Button>
                        </div>
                        {/* Tap-to-view hint */}
                        <div className="absolute inset-x-0 bottom-0 px-4 py-2 bg-gradient-to-t from-temple-deep/85 via-temple-deep/55 to-transparent text-[10px] tracking-wider font-semibold text-temple-gold uppercase opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 pointer-events-none">
                          <Eye className="w-3 h-3" /> Tap to view details
                        </div>
                      </div>
                      <CardContent className="p-5">
                        <div className="flex items-center gap-0.5 mb-2">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`w-3 h-3 ${i < Math.floor(product.rating) ? 'fill-temple-amber text-temple-amber' : 'text-temple-gold/20'}`} />
                          ))}
                          <span className="text-[10px] text-temple-gold/50 ml-1">({product.reviews})</span>
                        </div>
                        <h3 className="font-bold text-temple-deep text-sm mb-0.5">{product.name}</h3>
                        <p className="text-[11px] text-temple-gold/60 mb-0.5">{product.subtitle}</p>
                        <p className="text-[11px] text-temple-saffron/70 flex items-center gap-1">
                          <FlameKindling className="w-3 h-3" /> {product.fragrance}
                        </p>
                        <div className="flex items-center gap-2 mt-3">
                          <span className="text-lg font-bold text-temple-deep">₹{product.price}</span>
                          <span className="text-xs text-temple-gold/40 line-through">₹{product.originalPrice}</span>
                        </div>
                      </CardContent>
                      <CardFooter className="p-5 pt-0 flex gap-2">
                        <Button onClick={(e) => { e.stopPropagation(); addToCart(product) }}
                          className="flex-1 bg-temple-deep text-temple-gold hover:bg-temple-maroon border border-temple-gold/30 font-semibold text-xs h-10 transition-all shadow-md shadow-temple-deep/25"
                          size="sm">
                          <ShoppingCart className="w-3.5 h-3.5 mr-1.5" /> Add to Cart
                        </Button>
                        <Button onClick={(e) => { e.stopPropagation(); addToCart(product); router.push('/checkout') }}
                          className="flex-1 saffron-gradient text-white hover:brightness-110 font-semibold text-xs h-10 transition-all shadow-md shadow-temple-saffron/25"
                          size="sm">
                          <Flame className="w-3.5 h-3.5 mr-1.5" /> Buy Now
                        </Button>
                      </CardFooter>
                    </div>
                  </div>
                )
              })}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-16">
                <CircleDot className="w-10 h-10 text-temple-gold/20 mx-auto mb-3" />
                <p className="text-temple-gold/50">
                  {products.length === 0
                    ? 'No products yet — add some from the admin panel.'
                    : 'No products match your search.'}
                </p>
              </div>
            )}
          </div>
        </section>

        <OrnamentalDivider />

        {/* ====== SPECIAL OFFER BANNER ====== */}
        <section className="relative py-16 sm:py-20 overflow-hidden royal-gradient">
          {/* Kolam overlay */}
          <div className="absolute inset-0 opacity-[0.03]">
            <KolamPattern className="absolute top-0 right-0 w-[400px] h-[400px]" />
            <KolamPattern className="absolute bottom-0 left-0 w-[350px] h-[350px]" />
          </div>

          {/* Temple bell decorations */}
          <div className="absolute top-8 left-8 hidden lg:block opacity-30">
            <TempleBell className="w-6 h-10" />
          </div>
          <div className="absolute top-8 right-8 hidden lg:block opacity-30">
            <TempleBell className="w-6 h-10" />
          </div>

          <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 flex flex-col lg:flex-row items-center justify-between gap-10">
            <div className="flex-1 text-center lg:text-left reveal-left">
              <Badge className="bg-temple-amber/15 text-temple-amber border-temple-amber/25 mb-4">
                <Gem className="w-3 h-3 mr-1" /> Festive Special
              </Badge>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
                Complete Pooja Collection
              </h2>
              <p className="text-base text-white/65 mb-6 max-w-md">
                Save <span className="text-temple-amber font-bold text-xl">40%</span> This Festive Season
                — Includes Chandanam, Nag Champa, Rose Pushpam & Sambrani
              </p>
              <Button size="lg" onClick={addPoojaSet}
                className="saffron-gradient text-white hover:brightness-110 px-8 py-6 text-sm font-bold shadow-xl shadow-temple-saffron/25 transition-all animate-glow">
                <ShoppingCart className="w-4 h-4 mr-2" />
                Shop Pooja Set — ₹1,499
              </Button>
            </div>

            <div className="relative w-44 h-44 sm:w-52 sm:h-52 flex items-center justify-center shrink-0 reveal-right">
              {/* Decorative mandala rings */}
              <div className="absolute inset-0 border-2 border-temple-amber/20 rounded-full animate-mandala" style={{ animationDuration: '40s' }} />
              <div className="absolute inset-5 border border-temple-amber/15 rounded-full animate-mandala" style={{ animationDuration: '30s', animationDirection: 'reverse' }} />
              <div className="absolute inset-10 border border-temple-amber/10 rounded-full animate-mandala" style={{ animationDuration: '20s' }} />
              <div className="relative z-10 text-center">
                <div className="text-5xl sm:text-6xl font-black divine-text">40%</div>
                <div className="text-sm font-bold text-white/80 tracking-wider">OFF</div>
              </div>
            </div>
          </div>
        </section>

        <OrnamentalDivider />

        {/* ====== HERITAGE STORY SECTION ====== */}
        <section id="heritage" className="py-16 sm:py-20 bg-temple-cream">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="relative reveal-left">
                <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-temple-maroon/15">
                  <img src="/images/about-bg.png" alt="Temple heritage" width={600} height={400}
                    className="w-full h-auto object-cover" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-temple-maroon/60 via-temple-maroon/20 to-transparent" />
                  {/* Diya overlay */}
                  <div className="absolute bottom-6 left-6">
                    <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-temple-gold/20">
                      <DiyaFlame size={18} />
                      <span className="text-white/90 font-medium text-xs">Since 1948</span>
                    </div>
                  </div>
                  {/* Lotus decoration */}
                  <div className="absolute top-4 right-4 opacity-40">
                    <LotusIcon size={28} />
                  </div>
                </div>
                {/* Floating stats */}
                <div className="absolute -bottom-5 -right-5 bg-white rounded-xl shadow-xl p-4 border border-temple-gold/15 hidden sm:block animate-glow">
                  <div className="text-center">
                    <div className="text-xl font-bold gold-text-static">75+</div>
                    <div className="text-[10px] text-temple-gold/70">Years Legacy</div>
                  </div>
                </div>
                <div className="absolute -top-5 -left-5 bg-white rounded-xl shadow-xl p-4 border border-temple-gold/15 hidden sm:block">
                  <div className="text-center">
                    <div className="text-xl font-bold gold-text-static">500+</div>
                    <div className="text-[10px] text-temple-gold/70">Temples Trust Us</div>
                  </div>
                </div>
              </div>

              <div className="reveal-right">
                <Badge className="bg-temple-deep/8 text-temple-deep border-temple-deep/15 mb-4">
                  <Award className="w-3 h-3 mr-1" /> Our Heritage
                </Badge>
                <h2 className="text-3xl sm:text-4xl font-bold text-temple-deep mb-6">
                  A Legacy of <span className="gold-text-static">Sacred</span> Fragrance
                </h2>
                <div className="space-y-4 text-temple-deep/75 text-sm leading-relaxed">
                  <p>
                    For over 75 years, Shri Fragrance has been the custodian of South India&apos;s most
                    sacred incense traditions. Our journey began in the ancient temples of Tamil Nadu,
                    where our founder learned the art of blending divine fragrances from temple priests.
                  </p>
                  <p>
                    Each agarbathi is handcrafted using traditional methods passed down through three
                    generations. We source the finest sandalwood from Mysore, jasmine from Madurai,
                    and sacred herbs from the foothills of the Western Ghats.
                  </p>
                  <p>
                    Today, our incense fills over 500 temples across South India, and we bring that
                    same divine fragrance to your home pooja room.
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-8">
                  {[
                    { icon: FlameKindling, label: 'Sacred Blends' },
                    { icon: Flower2, label: 'Natural Herbs' },
                    { icon: Sun, label: 'Sun-Dried' }
                  ].map((item, i) => (
                    <div key={i} className="text-center p-4 rounded-xl bg-white border border-temple-gold/10 temple-card">
                      <item.icon className="w-6 h-6 text-temple-saffron mx-auto mb-2" />
                      <span className="text-[11px] font-semibold text-temple-deep">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <OrnamentalDivider />

        {/* ====== POOJA GUIDE SECTION ====== */}
        <section id="pooja-guide" className="py-16 sm:py-20 bg-white/40 kolam-pattern">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12 reveal-up">
              <Badge className="bg-temple-saffron/8 text-temple-saffron border-temple-saffron/15 mb-4">
                <Lamp className="w-3 h-3 mr-1" /> Sacred Guide
              </Badge>
              <div className="thoranam-arch pt-8">
                <h2 className="text-3xl sm:text-4xl font-bold text-temple-deep mb-3">
                  The <span className="divine-text">Divine</span> Pooja Path
                </h2>
              </div>
              <p className="text-sm text-temple-gold/80 max-w-lg mx-auto mt-4">
                Follow these sacred steps to create a blessed atmosphere in your home pooja room.
              </p>
            </div>

            {/* Steps with connecting line */}
            <div className="relative">
              <div className="hidden lg:block absolute top-1/2 left-[8%] right-[8%] h-px bg-gradient-to-r from-temple-gold/10 via-temple-saffron/30 to-temple-gold/10" />

              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-5 gap-6">
                {poojaSteps.map((step, i) => (
                  <div key={step.step} className="reveal-scale" style={{ transitionDelay: `${i * 120}ms` }}>
                    <div className="text-center p-6 rounded-xl bg-white border border-temple-gold/10 temple-card group">
                      <div className="relative mx-auto mb-4">
                        <div className="w-16 h-16 rounded-full saffron-gradient flex items-center justify-center mx-auto group-hover:scale-110 transition-transform duration-500 animate-glow">
                          <step.icon className="w-7 h-7 text-white" />
                        </div>
                        <div className="absolute -top-2 -right-1 w-6 h-6 rounded-full bg-temple-deep text-white text-[10px] font-bold flex items-center justify-center animate-diya">
                          {step.step}
                        </div>
                      </div>
                      <h3 className="font-bold text-temple-deep text-sm mb-1.5">{step.title}</h3>
                      <p className="text-[11px] text-temple-deep/50 leading-relaxed">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <OrnamentalDivider />

        {/* ====== TESTIMONIALS ====== */}
        <section className="py-16 sm:py-20 bg-temple-cream">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12 reveal-up">
              <Badge className="bg-temple-gold/8 text-temple-gold border-temple-gold/15 mb-4">
                <Sparkles className="w-3 h-3 mr-1" /> Devotee Reviews
              </Badge>
              <div className="thoranam-arch pt-8">
                <h2 className="text-3xl sm:text-4xl font-bold text-temple-deep">
                  Blessed by <span className="divine-text">Devotees</span>
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {testimonials.map((t, i) => (
                <div key={i} className="reveal-scale" style={{ transitionDelay: `${i * 120}ms` }}>
                  <div className="temple-card h-full bg-white">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-0.5 mb-4">
                        {Array.from({ length: t.rating }).map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-temple-amber text-temple-amber" />
                        ))}
                      </div>
                      <p className="text-sm text-temple-deep/70 leading-relaxed mb-5">&ldquo;{t.text}&rdquo;</p>
                      <div className="flex items-center gap-3 pt-4 border-t border-temple-gold/10">
                        <div className="w-10 h-10 rounded-full saffron-gradient flex items-center justify-center text-white text-xs font-bold animate-glow">
                          {t.avatar}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-temple-deep">{t.name}</p>
                          <p className="text-[11px] text-temple-gold/60">{t.location}</p>
                        </div>
                      </div>
                    </CardContent>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ====== NEWSLETTER ====== */}
        <section id="contact" className="relative py-16 sm:py-20 deep-maroon-gradient overflow-hidden">
          {/* Kolam overlay */}
          <div className="absolute inset-0 opacity-[0.04]">
            <KolamPattern className="absolute top-5 right-5 w-[300px] h-[300px]" />
          </div>

          {/* Temple bell decorations */}
          <div className="absolute top-10 left-10 hidden md:block opacity-20">
            <TempleBell className="w-8 h-14" />
          </div>
          <div className="absolute top-10 right-10 hidden md:block opacity-20">
            <TempleBell className="w-8 h-14" />
          </div>

          <div className="relative max-w-2xl mx-auto px-4 sm:px-6 text-center">
            <div className="reveal-up">
              <div className="animate-diya mx-auto mb-5">
                <DiyaFlame size={40} />
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
                Stay Blessed with Sacred Updates
              </h2>
              <p className="text-sm text-white/55 mb-8">
                Subscribe to receive exclusive offers, new fragrance launches, and sacred festival reminders.
              </p>
              <form onSubmit={handleNewsletterSubmit} className="flex gap-3 max-w-md mx-auto">
                <Input
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 bg-white/10 border-temple-gold/25 text-white placeholder:text-white/40 focus:border-temple-gold/50"
                  type="email"
                />
                <Button type="submit"
                  className="saffron-gradient text-white hover:brightness-110 px-6 h-11 font-semibold text-sm transition-all shadow-lg shadow-temple-saffron/25">
                  Subscribe
                </Button>
              </form>
            </div>
          </div>
        </section>

        {/* ====== FOOTER ====== */}
        <footer className="bg-temple-maroon pt-14 pb-6 relative overflow-hidden">
          {/* Decorative top border */}
          <div className="absolute top-0 left-0 right-0 h-1 gold-gradient-h" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
              {/* Brand */}
              <div className="col-span-2 md:col-span-1">
                <div className="flex items-center gap-2 mb-4">
                  <img src="/images/logo.png" alt="Logo" width={36} height={36} className="rounded-full" />
                  <div>
                    <h3 className="font-bold text-white text-sm tracking-wider">SHRI FRAGRANCE</h3>
                    <p className="text-[9px] text-temple-amber/60 tracking-wider">SACRED TEMPLE AGARBATHI</p>
                  </div>
                </div>
                <p className="text-xs text-white/40 leading-relaxed max-w-[220px]">
                  Handcrafted with devotion, blessed in sacred temples, delivered with love to your home.
                </p>
                <div className="flex items-center gap-2 mt-4">
                  <DiyaFlame size={16} />
                  <span className="text-[10px] text-temple-amber/50">Illuminating homes since 1948</span>
                </div>
              </div>

              {/* Quick Links */}
              <div>
                <h4 className="font-semibold text-temple-gold text-xs tracking-wider mb-4 uppercase">Quick Links</h4>
                <ul className="space-y-2">
                  {['Home', 'Collections', 'Heritage', 'Pooja Guide', 'Contact'].map(item => (
                    <li key={item}>
                      <a href={`#${item.toLowerCase().replace(' ', '-')}`} className="text-xs text-white/50 hover:text-temple-gold transition-colors">{item}</a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Categories */}
              <div>
                <h4 className="font-semibold text-temple-gold text-xs tracking-wider mb-4 uppercase">Categories</h4>
                <ul className="space-y-2">
                  {['Premium Incense', 'Floral Collection', 'Classic Blends', 'Herbal Range', 'Pooja Kits'].map(item => (
                    <li key={item}>
                      <a href="#products" className="text-xs text-white/50 hover:text-temple-gold transition-colors">{item}</a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Contact */}
              <div>
                <h4 className="font-semibold text-temple-gold text-xs tracking-wider mb-4 uppercase">Contact</h4>
                <ul className="space-y-3">
                  <li className="flex items-start gap-2 text-xs text-white/50">
                    <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    42, Temple Street, Chennai 600017
                  </li>
                  <li className="flex items-center gap-2 text-xs text-white/50">
                    <Phone className="w-3.5 h-3.5 shrink-0" />
                    +91 98765 43210
                  </li>
                  <li className="flex items-center gap-2 text-xs text-white/50">
                    <Mail className="w-3.5 h-3.5 shrink-0" />
                    info@shrifragrance.com
                  </li>
                </ul>
              </div>
            </div>

            {/* Bottom bar */}
            <div className="border-t border-temple-gold/10 pt-5 flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-[11px] text-white/30">© 2025 Shri Fragrance. All rights reserved.</p>
              <div className="flex items-center gap-4 text-[11px] text-white/30">
                <a href="#" className="hover:text-temple-gold transition-colors">Privacy Policy</a>
                <a href="#" className="hover:text-temple-gold transition-colors">Terms of Service</a>
                <a href="#" className="hover:text-temple-gold transition-colors">Refund Policy</a>
              </div>
            </div>
          </div>
        </footer>
      </main>


      {/* ====== QUICK VIEW DIALOG ====== */}
      <Dialog open={!!quickViewProduct} onOpenChange={() => setQuickViewProduct(null)}>
        <DialogContent className="max-w-lg bg-temple-cream">
          {quickViewProduct && (
            <>
              <DialogTitle className="sr-only">{quickViewProduct.name}</DialogTitle>
              <DialogDescription className="sr-only">{quickViewProduct.subtitle} — {quickViewProduct.fragrance}</DialogDescription>
              <div className="flex flex-col sm:flex-row gap-5 p-2">
                <div className="flex-1 bg-white rounded-xl p-4">
                  <img src={quickViewProduct.image} alt={quickViewProduct.name} className="w-full h-auto object-contain" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <Badge className={`${quickViewProduct.badgeColor} text-[10px] mb-2`}>{quickViewProduct.badge}</Badge>
                    <h3 className="text-lg font-bold text-temple-deep">{quickViewProduct.name}</h3>
                    <p className="text-xs text-temple-gold/60">{quickViewProduct.subtitle}</p>
                  </div>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`w-3.5 h-3.5 ${i < Math.floor(quickViewProduct.rating) ? 'fill-temple-amber text-temple-amber' : 'text-temple-gold/20'}`} />
                    ))}
                    <span className="text-[10px] text-temple-gold/50 ml-1">({quickViewProduct.reviews} reviews)</span>
                  </div>
                  <p className="text-xs text-temple-saffron/70 flex items-center gap-1">
                    <FlameKindling className="w-3 h-3" /> {quickViewProduct.fragrance}
                  </p>
                  {quickViewProduct.description && (
                    <p className="text-xs text-temple-deep/70 leading-relaxed">
                      {quickViewProduct.description}
                    </p>
                  )}
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-temple-deep">₹{quickViewProduct.price}</span>
                    <span className="text-sm text-temple-gold/40 line-through">₹{quickViewProduct.originalPrice}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => { addToCart(quickViewProduct); setQuickViewProduct(null) }}
                      className="flex-1 bg-temple-deep text-temple-gold hover:bg-temple-maroon border border-temple-gold/30 font-semibold shadow-md shadow-temple-deep/25">
                      <ShoppingCart className="w-4 h-4 mr-2" /> Add to Cart
                    </Button>
                    <Button onClick={() => { addToCart(quickViewProduct); setQuickViewProduct(null); router.push('/checkout') }}
                      className="flex-1 saffron-gradient text-white hover:brightness-110 font-semibold shadow-md shadow-temple-saffron/25">
                      <Flame className="w-4 h-4 mr-2" /> Buy Now
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ====== SCROLL TO TOP ====== */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full saffron-gradient text-white shadow-xl shadow-temple-saffron/30 flex items-center justify-center hover:brightness-110 transition-all animate-fade-in"
          style={{ boxShadow: '0 4px 20px rgba(212, 114, 42, 0.4)' }}
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}
