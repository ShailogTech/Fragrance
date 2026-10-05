'use client'

// Shri Fragrance — static landing page.
//
// Products are read from `public/products.json`: the copy baked into this
// bundle renders instantly, then a live copy is pulled from
// raw.githubusercontent.com so admin edits show up without a redeploy.
// There is no server, no cart, no checkout — contact details are the call
// to action.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Flame, Phone, Mail, Menu, X, ChevronRight, Award, MessageCircle,
  FlameKindling, Flower2, Sun, ArrowUp,
} from 'lucide-react'
import {
  bakedProducts, fetchLiveProducts, DEFAULT_GH, type Product,
} from '@/lib/products'

const PHONE_DISPLAY = '+91 98765 43210'
const PHONE_TEL = 'tel:+919876543210'
const WHATSAPP_URL = 'https://wa.me/919876543210'
const EMAIL = 'info@shrifragrance.com'

// ====== DECORATIVE SVGs ======

function DiyaFlame({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <div className={`animate-diya ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
        <ellipse cx="16" cy="10" rx="4" ry="8" fill="url(#flameGrad)" opacity="0.9" />
        <ellipse cx="16" cy="12" rx="2" ry="5" fill="#FFD700" opacity="0.8" />
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

const svgCoord = (n: number) => Math.round(n * 1000) / 1000

function KolamPattern({ className = '' }: { className?: string }) {
  return (
    <svg className={`opacity-[0.05] ${className}`} viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="80" stroke="#C5972E" strokeWidth="0.5" />
      <circle cx="100" cy="100" r="60" stroke="#C5972E" strokeWidth="0.5" />
      <circle cx="100" cy="100" r="40" stroke="#C5972E" strokeWidth="0.5" />
      <circle cx="100" cy="100" r="20" stroke="#C5972E" strokeWidth="0.5" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
        <line key={angle}
          x1="100" y1="100"
          x2={svgCoord(100 + 80 * Math.cos((angle * Math.PI) / 180))}
          y2={svgCoord(100 + 80 * Math.sin((angle * Math.PI) / 180))}
          stroke="#C5972E" strokeWidth="0.5" />
      ))}
      {[0, 45, 90, 135].map((angle) => (
        <circle key={`d${angle}`}
          cx={svgCoord(100 + 70 * Math.cos((angle * Math.PI) / 180))}
          cy={svgCoord(100 + 70 * Math.sin((angle * Math.PI) / 180))}
          r="4" fill="#C5972E" />
      ))}
    </svg>
  )
}

// ====== PAGE ======

export default function LandingPage() {
  const [products, setProducts] = useState<Product[]>(bakedProducts)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)

  // Refresh the catalog from the live repo copy (baked copy already shown).
  useEffect(() => {
    let active = true
    void fetchLiveProducts(DEFAULT_GH).then((live) => {
      if (active && live) setProducts(live)
    })
    return () => { active = false }
  }, [])

  // Reveal-on-scroll + back-to-top visibility.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) entry.target.classList.add('revealed')
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -40px 0px' },
    )
    document.querySelectorAll('.reveal-up, .reveal-left, .reveal-right, .reveal-scale')
      .forEach((el) => io.observe(el))

    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        setShowScrollTop(window.scrollY > 500)
        ticking = false
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { io.disconnect(); window.removeEventListener('scroll', onScroll) }
  }, [])

  const navItems = [
    { label: 'Home', href: '#home' },
    { label: 'Collection', href: '#products' },
    { label: 'Heritage', href: '#heritage' },
    { label: 'Contact', href: '#contact' },
  ]

  const trustItems = [
    '100% Natural Ingredients', 'Handcrafted with Devotion', 'Trusted by 500+ Temples',
    '75+ Years of Sacred Tradition', 'Hand-Rolled in Tamil Nadu', 'Pure Temple-Grade Blends',
  ]

  return (
    <div className="min-h-screen bg-temple-cream">
      {/* ====== HEADER ====== */}
      <header className="sticky top-0 z-50 bg-temple-cream/95 border-b border-temple-gold/15" style={{ backdropFilter: 'blur(12px)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between py-1.5 text-[11px] text-temple-gold/80 border-b border-temple-gold/8">
            <div className="flex items-center gap-4">
              <a href={PHONE_TEL} className="flex items-center gap-1 hover:text-temple-saffron transition-colors">
                <Phone className="w-3 h-3" /> {PHONE_DISPLAY}
              </a>
              <a href={`mailto:${EMAIL}`} className="hidden sm:flex items-center gap-1 hover:text-temple-saffron transition-colors">
                <Mail className="w-3 h-3" /> {EMAIL}
              </a>
            </div>
            <div className="flex items-center gap-1">
              <Flame className="w-3 h-3" />
              <span>Handcrafted Sacred Temple Agarbathi</span>
            </div>
          </div>

          <div className="flex items-center justify-between py-3 gap-4">
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

            <nav className="hidden lg:flex items-center gap-1">
              {navItems.map((item) => (
                <a key={item.label} href={item.href}
                  className="px-3 py-2 text-sm font-medium text-temple-deep/80 hover:text-temple-saffron rounded-md hover:bg-temple-gold/5 transition-colors">
                  {item.label}
                </a>
              ))}
            </nav>

            <div className="flex items-center gap-2">
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-full saffron-gradient text-white text-xs font-semibold shadow-lg shadow-temple-saffron/25 hover:brightness-110 transition-all">
                <MessageCircle className="w-3.5 h-3.5" /> WhatsApp Us
              </a>
              <button type="button" aria-label="Open menu"
                className="lg:hidden text-temple-deep/70 hover:text-temple-saffron h-10 w-10 flex items-center justify-center"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Mobile nav */}
          {mobileMenuOpen && (
            <nav className="lg:hidden flex flex-col gap-1 pb-4">
              {navItems.map((item) => (
                <a key={item.label} href={item.href} onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between px-4 py-3 text-sm font-medium text-temple-deep/85 hover:bg-temple-gold/10 rounded-lg transition-colors">
                  {item.label}
                  <ChevronRight className="w-4 h-4 opacity-30" />
                </a>
              ))}
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" onClick={() => setMobileMenuOpen(false)}
                className="flex items-center justify-center gap-2 px-4 py-3 mt-1 rounded-lg saffron-gradient text-white text-sm font-semibold">
                <MessageCircle className="w-4 h-4" /> WhatsApp Us
              </a>
            </nav>
          )}
        </div>
      </header>

      <main>
        {/* ====== HERO ====== */}
        <section id="home" className="relative min-h-[88vh] flex items-center overflow-hidden">
          <div className="absolute inset-0">
            <img src="/images/hero-bg.png" alt="South Indian temple gopuram" className="absolute inset-0 w-full h-full object-cover" loading="eager" />
            <div className="absolute inset-0 bg-gradient-to-br from-temple-maroon/94 via-temple-deep/88 to-temple-maroon/80" />
          </div>
          <KolamPattern className="absolute -right-20 -top-20 w-[420px] h-[420px]" />

          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20">
            <div className="max-w-2xl">
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

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 mb-10 sm:mb-16">
                <a href="#products"
                  className="inline-flex items-center justify-center gap-2 saffron-gradient text-white hover:brightness-110 px-8 py-4 text-sm font-semibold shadow-lg shadow-temple-saffron/30 transition-all animate-glow rounded-md">
                  <Flame className="w-4 h-4" />
                  Explore Collection
                </a>
                <a href="#heritage"
                  className="inline-flex items-center justify-center gap-2 border border-temple-gold/30 text-white/90 hover:bg-temple-gold/10 hover:border-temple-gold/50 px-8 py-4 text-sm bg-transparent rounded-md transition-colors">
                  Our Heritage
                </a>
              </div>

              <div className="flex gap-8 sm:gap-14">
                {[
                  { value: '8', label: 'Sacred Fragrances' },
                  { value: '75+', label: 'Years of Tradition' },
                  { value: '500+', label: 'Temples Trust Us' },
                ].map((stat) => (
                  <div key={stat.label} className="text-center">
                    <div className="text-2xl sm:text-3xl font-bold gold-text">{stat.value}</div>
                    <div className="text-[10px] sm:text-[11px] text-white/45 uppercase tracking-wider mt-1">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ====== TRUST MARQUEE ====== */}
        <div className="bg-temple-deep py-3.5 overflow-hidden border-y border-temple-gold/15">
          <div className="flex whitespace-nowrap animate-marquee w-max">
            {[...trustItems, ...trustItems].map((item, i) => (
              <span key={i} className="inline-flex items-center gap-2 mx-6 text-xs text-temple-gold/75 tracking-wide">
                <DiyaFlame size={12} />
                {item}
              </span>
            ))}
          </div>
        </div>

        {/* ====== PRODUCTS ====== */}
        <section id="products" className="py-16 sm:py-20 bg-temple-cream kolam-pattern">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12 reveal-up">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-temple-deep/6 border border-temple-deep/12 mb-4">
                <FlameKindling className="w-3 h-3 text-temple-saffron" />
                <span className="text-[11px] font-semibold tracking-[0.15em] text-temple-deep/70 uppercase">Sacred Collection</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-temple-deep mb-3">
                Our <span className="gold-text-static">Fragrances</span>
              </h2>
              <p className="text-sm text-temple-deep/55 max-w-xl mx-auto">
                Hand-rolled agarbathi made the traditional way — to order, call or message us and
                we&apos;ll arrange delivery to your home or temple.
              </p>
            </div>

            {products.length === 0 ? (
              <p className="text-center text-sm text-temple-deep/50 py-12">
                Our collection is being refreshed — please check back soon.
              </p>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
                {products.map((p, i) => (
                  <article key={p.id}
                    className={`temple-card group bg-white rounded-2xl border border-temple-gold/12 overflow-hidden transition-all duration-300 hover:shadow-xl hover:shadow-temple-maroon/10 ${i % 4 === 0 ? 'reveal-left' : i % 4 === 3 ? 'reveal-right' : 'reveal-up'}`}>
                    <div className="relative aspect-square overflow-hidden bg-temple-cream">
                      <img src={p.image} alt={p.name} loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        onError={(e) => { (e.target as HTMLImageElement).src = '/images/product1.png' }} />
                      <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-temple-deep/85 text-temple-gold text-[10px] font-semibold tracking-wide backdrop-blur-sm">
                        {p.category}
                      </span>
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <h3 className="font-bold text-temple-deep text-sm sm:text-base leading-tight">{p.name}</h3>
                        <span className="shrink-0 text-sm font-bold text-temple-saffron">₹{p.price}</span>
                      </div>
                      <p className="text-[11px] sm:text-xs text-temple-deep/55 leading-relaxed line-clamp-3">{p.description}</p>
                    </div>
                  </article>
                ))}
              </div>
            )}

            <div className="mt-12 text-center reveal-up">
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-full saffron-gradient text-white text-sm font-semibold shadow-lg shadow-temple-saffron/25 hover:brightness-110 transition-all">
                <MessageCircle className="w-4 h-4" />
                Order on WhatsApp
              </a>
              <p className="text-[11px] text-temple-deep/45 mt-3">
                or call <a href={PHONE_TEL} className="font-semibold text-temple-saffron">{PHONE_DISPLAY}</a> — free delivery on orders above ₹499
              </p>
            </div>
          </div>
        </section>

        {/* ====== HERITAGE ====== */}
        <section id="heritage" className="py-16 sm:py-20 bg-white/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div className="relative reveal-left">
                <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-temple-maroon/15">
                  <img src="/images/about-bg.png" alt="Temple heritage" width={600} height={400}
                    className="w-full h-auto object-cover" loading="lazy" />
                  <div className="absolute inset-0 bg-gradient-to-t from-temple-maroon/60 via-temple-maroon/20 to-transparent" />
                  <div className="absolute bottom-6 left-6">
                    <div className="flex items-center gap-3 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-full border border-temple-gold/20">
                      <DiyaFlame size={18} />
                      <span className="text-white/90 font-medium text-xs">Since 1948</span>
                    </div>
                  </div>
                </div>
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
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-temple-deep/6 border border-temple-deep/12 mb-4">
                  <Award className="w-3 h-3 text-temple-saffron" />
                  <span className="text-[11px] font-semibold tracking-[0.15em] text-temple-deep/70 uppercase">Our Heritage</span>
                </div>
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
                    { icon: Sun, label: 'Sun-Dried' },
                  ].map((item) => (
                    <div key={item.label} className="text-center p-4 rounded-xl bg-white border border-temple-gold/10 temple-card">
                      <item.icon className="w-6 h-6 text-temple-saffron mx-auto mb-2" />
                      <span className="text-[11px] font-semibold text-temple-deep">{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ====== CONTACT ====== */}
        <section id="contact" className="relative py-16 sm:py-20 deep-maroon-gradient overflow-hidden">
          <KolamPattern className="absolute top-5 right-5 w-[300px] h-[300px]" />

          <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
            <div className="reveal-up">
              <div className="animate-diya mx-auto mb-5">
                <DiyaFlame size={40} />
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
                Bring the Sacred Home
              </h2>
              <p className="text-sm text-white/55 mb-10 max-w-lg mx-auto">
                Call, message, or email us to place an order or ask about custom blends for your
                temple, function, or daily pooja.
              </p>

              <div className="grid sm:grid-cols-3 gap-4">
                <a href={PHONE_TEL}
                  className="flex flex-col items-center gap-2 p-6 rounded-2xl bg-white/6 border border-temple-gold/15 hover:bg-white/10 hover:border-temple-gold/30 transition-all">
                  <Phone className="w-5 h-5 text-temple-amber" />
                  <span className="text-white font-semibold text-sm">{PHONE_DISPLAY}</span>
                  <span className="text-[11px] text-white/40">Call to order</span>
                </a>
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
                  className="flex flex-col items-center gap-2 p-6 rounded-2xl bg-white/6 border border-temple-gold/15 hover:bg-white/10 hover:border-temple-gold/30 transition-all">
                  <MessageCircle className="w-5 h-5 text-temple-amber" />
                  <span className="text-white font-semibold text-sm">WhatsApp</span>
                  <span className="text-[11px] text-white/40">Chat with us</span>
                </a>
                <a href={`mailto:${EMAIL}`}
                  className="flex flex-col items-center gap-2 p-6 rounded-2xl bg-white/6 border border-temple-gold/15 hover:bg-white/10 hover:border-temple-gold/30 transition-all">
                  <Mail className="w-5 h-5 text-temple-amber" />
                  <span className="text-white font-semibold text-sm">{EMAIL}</span>
                  <span className="text-[11px] text-white/40">Write to us</span>
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ====== FOOTER ====== */}
      <footer className="bg-temple-maroon pt-14 pb-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-1 gold-gradient-h" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img src="/images/logo.png" alt="Shri Fragrance logo" width={36} height={36} className="rounded-full" />
                <div>
                  <h3 className="font-bold text-white text-sm tracking-wider">SHRI FRAGRANCE</h3>
                  <p className="text-[9px] text-temple-amber/60 tracking-wider">SACRED TEMPLE AGARBATHI</p>
                </div>
              </div>
              <p className="text-xs text-white/40 leading-relaxed max-w-[260px]">
                Handcrafted with devotion, blessed in sacred temples, delivered with love to your home.
              </p>
              <div className="flex items-center gap-2 mt-4">
                <DiyaFlame size={16} />
                <span className="text-[11px] text-temple-gold/50">Sacred traditions since 1948</span>
              </div>
            </div>

            <div>
              <h4 className="text-white font-semibold text-sm mb-4 tracking-wide">Explore</h4>
              <nav className="flex flex-col gap-2.5">
                {navItems.map((item) => (
                  <a key={item.label} href={item.href}
                    className="text-xs text-white/45 hover:text-temple-gold transition-colors">
                    {item.label}
                  </a>
                ))}
              </nav>
            </div>

            <div>
              <h4 className="text-white font-semibold text-sm mb-4 tracking-wide">Reach Us</h4>
              <div className="flex flex-col gap-3">
                <a href={PHONE_TEL} className="flex items-center gap-2.5 text-xs text-white/45 hover:text-temple-gold transition-colors">
                  <Phone className="w-3.5 h-3.5" /> {PHONE_DISPLAY}
                </a>
                <a href={`mailto:${EMAIL}`} className="flex items-center gap-2.5 text-xs text-white/45 hover:text-temple-gold transition-colors">
                  <Mail className="w-3.5 h-3.5" /> {EMAIL}
                </a>
                <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2.5 text-xs text-white/45 hover:text-temple-gold transition-colors">
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                </a>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-white/8 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-[11px] text-white/30">
              © {new Date().getFullYear()} Shri Fragrance. All rights reserved.
            </p>
            <Link href="/admin/" className="text-[11px] text-white/25 hover:text-temple-gold/70 transition-colors">
              Product Manager
            </Link>
          </div>
        </div>
      </footer>

      {/* Back to top */}
      {showScrollTop && (
        <button type="button" aria-label="Back to top" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-40 w-11 h-11 rounded-full saffron-gradient text-white shadow-lg shadow-temple-saffron/30 flex items-center justify-center hover:brightness-110 transition-all">
          <ArrowUp className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}
