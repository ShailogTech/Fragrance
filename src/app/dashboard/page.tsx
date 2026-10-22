'use client'

import { useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ensureAdminSeed, getSession, logout as authLogout, subscribeAuth, type Session } from '@/lib/auth'
import {
  ShoppingBag, Heart, Award, MapPin, User, Settings,
  ArrowLeft, Package, CheckCircle2, Truck,
  ChevronDown, ChevronUp, Flame, Sparkles, Gift,
  Crown, Trash2, Plus, Edit3, IndianRupee,
  Bell, Shield, Lock, Save, Eye, Wallet,
  X, Phone, Mail, CalendarDays, Home, Store
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { addToStoredCart, CART_KEY, type CartLine } from '@/lib/cart'
import { fetchMyOrders, ORDERS_KEY, cancelStoredOrder } from '@/lib/orders'
import { fetchWishlist, removeFromWishlist } from '@/lib/wishlist'
import { XCircle } from 'lucide-react'

// ====== TYPES ======

interface OrderItem {
  name: string
  qty: number
  price: number
  image: string
}

interface OrderCustomer { name: string; email: string; phone: string }
interface OrderShipment { address: string; city: string; state: string; pincode: string; notes?: string; method?: string }

interface Order {
  id: string
  date: string
  status: 'Delivered' | 'Processing' | 'Shipped' | 'Cancelled'
  items: OrderItem[]
  total: number
  customer?: OrderCustomer
  shipment?: OrderShipment
}

interface WishlistItem {
  id: number
  name: string
  price: number
  originalPrice: number
  image: string
  inStock: boolean
}

interface Address {
  id: number
  label: string
  name: string
  line1: string
  line2: string
  pincode: string
  phone: string
  isDefault: boolean
}

interface NotificationSettings {
  orderUpdates: boolean
  promoOffers: boolean
  priceDrop: boolean
  newArrivals: boolean
  loyaltyPoints: boolean
}

// ====== MOCK DATA ======

const userData = {
  name: 'Priya Sharma',
  email: 'priya.sharma@email.com',
  phone: '+91 98765 43210',
  initials: 'PS',
  memberSince: 'January 2023',
  membership: 'Temple Gold Member',
}

const deriveInitials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join('') || 'U'

const PROFILE_KEY = 'shri:profile'

const persistProfile = (p: { name: string; email: string; phone: string }) => {
  try { localStorage.setItem(PROFILE_KEY, JSON.stringify(p)) } catch { /* storage unavailable */ }
}

const orders: Order[] = [
  {
    id: 'SF-7841', date: '12 Mar 2025', status: 'Delivered',
    items: [
      { name: 'Chandanam Sandalwood', qty: 2, price: 698, image: '/images/product1.png' },
      { name: 'Nag Champa Classic', qty: 1, price: 299, image: '/images/product3.png' },
    ],
    total: 997,
  },
  {
    id: 'SF-7830', date: '08 Mar 2025', status: 'Shipped',
    items: [{ name: 'Malligai Jasmine', qty: 3, price: 747, image: '/images/product2.png' }],
    total: 747,
  },
  {
    id: 'SF-7815', date: '28 Feb 2025', status: 'Processing',
    items: [
      { name: 'Sambrani Herbal', qty: 1, price: 399, image: '/images/product5.png' },
      { name: 'Roja Camphor Blend', qty: 1, price: 279, image: '/images/product4.png' },
    ],
    total: 678,
  },
  {
    id: 'SF-7798', date: '15 Feb 2025', status: 'Delivered',
    items: [{ name: 'Khus Vetiver Classic', qty: 2, price: 538, image: '/images/product6.png' }],
    total: 538,
  },
  {
    id: 'SF-7780', date: '02 Feb 2025', status: 'Delivered',
    items: [
      { name: 'Chandanam Sandalwood', qty: 1, price: 349, image: '/images/product1.png' },
      { name: 'Malligai Jasmine', qty: 1, price: 249, image: '/images/product2.png' },
      { name: 'Nag Champa Classic', qty: 2, price: 598, image: '/images/product3.png' },
    ],
    total: 1196,
  },
]


const initialAddresses: Address[] = [
  { id: 1, label: 'Home', name: 'Priya Sharma', line1: '42, Sri Venkateswara Street', line2: 'T. Nagar, Chennai', pincode: '600017', phone: '+91 98765 43210', isDefault: true },
  { id: 2, label: 'Temple Town', name: 'Priya Sharma', line1: '15, Raja Veethi, Madurai', line2: 'Near Meenakshi Temple', pincode: '625001', phone: '+91 98765 43210', isDefault: false },
  { id: 3, label: 'Office', name: 'Priya Sharma', line1: '3rd Floor, Gopuram Towers', line2: 'Mount Road, Chennai', pincode: '600002', phone: '+91 98765 43211', isDefault: false },
]

// ====== STATUS HELPER ======

function getStatusBadge(status: Order['status']) {
  switch (status) {
    case 'Delivered':
      return <Badge className="bg-green-100 text-green-700 border-green-200 text-xs"><CheckCircle2 className="h-3 w-3 mr-1" />Delivered</Badge>
    case 'Shipped':
      return <Badge className="bg-blue-100 text-blue-700 border-blue-200 text-xs"><Truck className="h-3 w-3 mr-1" />Shipped</Badge>
    case 'Processing':
      return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs"><Package className="h-3 w-3 mr-1" />Processing</Badge>
    case 'Cancelled':
      return <Badge className="bg-red-100 text-red-700 border-red-200 text-xs"><XCircle className="h-3 w-3 mr-1" />Cancelled</Badge>
  }
}

function getStatusStep(status: Order['status']): number {
  switch (status) {
    case 'Processing': return 0
    case 'Shipped': return 1
    case 'Delivered': return 2
    case 'Cancelled': return -1
  }
}

// ====== ORDER TRACKING STEPS ======

function OrderTrackingSteps({ status }: { status: Order['status'] }) {
  const steps = ['Ordered', 'Shipped', 'Delivered']
  const icons = [Package, Truck, CheckCircle2]
  const currentStep = getStatusStep(status)

  return (
    <div className="flex items-center w-full mt-4">
      {steps.map((label, i) => {
        const IconComp = icons[i]
        const isActive = i <= currentStep
        const isCurrent = i === currentStep
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center flex-shrink-0">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-colors duration-300 ${
                  isActive
                    ? 'bg-temple-gold border-temple-gold text-white'
                    : 'bg-temple-cream border-temple-gold/30 text-temple-gold/40'
                } ${isCurrent ? 'animate-glow' : ''}`}
              >
                <IconComp className="h-4 w-4" />
              </div>
              <span className={`text-[10px] mt-1 font-medium whitespace-nowrap ${isActive ? 'text-temple-deep' : 'text-muted-foreground/40'}`}>
                {label}
              </span>
            </div>
            {i < 2 && (
              <div className="flex-1 mx-2 mt-[-16px]">
                <div className="h-[2px] rounded-full bg-temple-gold/20 overflow-hidden">
                  <div
                    className={`h-full bg-temple-gold rounded-full transition-all duration-700 ${i < currentStep ? 'w-full' : 'w-0'}`}
                  />
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ====== MAIN DASHBOARD ======

export default function UserDashboard() {
  const { toast } = useToast()
  const router = useRouter()
  const [session, setSession] = useState<Session | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    ensureAdminSeed()
    const refresh = () => {
      const s = getSession()
      setSession(s)
      setAuthChecked(true)
      if (!s) router.replace('/login?next=/dashboard')
    }
    refresh()
    return subscribeAuth(refresh)
  }, [router])

  const handleLogout = useCallback(() => {
    authLogout()
    router.replace('/')
  }, [router])

  // Tab state
  const [activeTab, setActiveTab] = useState('orders')
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null)

  // Wishlist state — loaded from the backend (Firestore, cached locally) and
  // re-fetched when the auth session changes so it syncs across devices.
  const [wishlist, setWishlist] = useState<WishlistItem[]>([])
  useEffect(() => {
    let active = true
    const load = async () => {
      const items = await fetchWishlist()
      if (!active) return
      setWishlist(items.map(i => ({
        id: i.id,
        name: i.name,
        price: i.price,
        originalPrice: i.originalPrice,
        image: i.image,
        inStock: i.inStock ?? true,
      })))
    }
    void load()
    const unsub = subscribeAuth(() => { void load() })
    return () => { active = false; unsub() }
  }, [])

  // Address state
  const [addresses, setAddresses] = useState<Address[]>(initialAddresses)
  const [addressDialogOpen, setAddressDialogOpen] = useState(false)
  const [editingAddress, setEditingAddress] = useState<Address | null>(null)
  const [addressDraft, setAddressDraft] = useState({ label: '', name: '', line1: '', line2: '', pincode: '', phone: '' })

  // Settings state
  const [user, setUser] = useState(userData)
  const [profileForm, setProfileForm] = useState({ name: userData.name, email: userData.email, phone: userData.phone })

  // Seed profile from auth session first (so the dashboard reflects the
  // logged-in user), then layer on any saved profile edits.
  useEffect(() => {
    if (!session) return
    let name = session.name
    let email = session.email
    let phone = ''
    try {
      const raw = localStorage.getItem(PROFILE_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as { name?: string; email?: string; phone?: string }
        if (saved.email && saved.email === session.email) {
          name = saved.name ?? name
          phone = saved.phone ?? phone
        }
      }
    } catch { /* ignore corrupt/unavailable storage */ }
    setUser(prev => ({ ...prev, name, email, phone, initials: deriveInitials(name) }))
    setProfileForm({ name, email, phone })
  }, [session])
  const [passwordForm, setPasswordForm] = useState({ current: '', newPass: '', confirm: '' })
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false)
  const [notifSettings, setNotifSettings] = useState<NotificationSettings>({
    orderUpdates: true,
    promoOffers: true,
    priceDrop: true,
    newArrivals: false,
    loyaltyPoints: true,
  })
  const [settingsSaving, setSettingsSaving] = useState(false)
  const [deleteAccountDialogOpen, setDeleteAccountDialogOpen] = useState(false)

  // Edit Profile Dialog
  const [editProfileOpen, setEditProfileOpen] = useState(false)

  // Cancel order state
  const [cancelOrderId, setCancelOrderId] = useState<string | null>(null)

  // Real orders from the backend (Firestore, cached in localStorage), shown
  // above the mock history. Re-fetched whenever the auth session changes so a
  // user's orders sync in once Firebase restores their session.
  const [storedOrders, setStoredOrders] = useState<Order[]>([])
  useEffect(() => {
    let active = true
    const load = async () => {
      const orders = await fetchMyOrders()
      if (!active) return
      setStoredOrders(
        orders.map(o => ({
          id: o.id,
          date: o.date,
          status: o.status as Order['status'],
          total: o.total,
          items: o.items.map(i => ({
            name: i.name,
            qty: i.quantity,
            price: i.price,
            image: i.image,
          })),
          customer: o.customer,
          shipment: o.shipment,
        })),
      )
    }
    void load()
    const unsub = subscribeAuth(() => { void load() })
    return () => { active = false; unsub() }
  }, [])

  const [cancelledMockIds, setCancelledMockIds] = useState<Set<string>>(new Set())

  const allOrders: Order[] = [
    ...storedOrders,
    ...orders.map(o => cancelledMockIds.has(o.id) ? { ...o, status: 'Cancelled' as const } : o),
  ]

  // ====== HANDLERS ======

  const handleToggleOrder = useCallback((orderId: string) => {
    setExpandedOrder(prev => prev === orderId ? null : orderId)
  }, [])

  const handleRemoveFromWishlist = useCallback((id: number) => {
    const item = wishlist.find(w => w.id === id)
    removeFromWishlist(id)
    setWishlist(prev => prev.filter(w => w.id !== id))
    toast({ title: 'Removed from Wishlist', description: `${item?.name || 'Item'} removed from your wishlist.` })
  }, [wishlist, toast])

  const handleMoveToCart = useCallback((item: WishlistItem) => {
    if (!item.inStock) return
    addToStoredCart([{ id: item.id, name: item.name, price: item.price, image: item.image, quantity: 1 }])
    removeFromWishlist(item.id)
    setWishlist(prev => prev.filter(w => w.id !== item.id))
    toast({ title: 'Added to Cart!', description: `${item.name} has been moved to your cart.` })
  }, [toast])

  const handleConfirmCancel = useCallback(() => {
    if (!cancelOrderId) return
    const isStored = storedOrders.some(o => o.id === cancelOrderId)
    if (isStored) {
      cancelStoredOrder(cancelOrderId)
      setStoredOrders(prev => prev.map(o => o.id === cancelOrderId ? { ...o, status: 'Cancelled' } : o))
    } else {
      setCancelledMockIds(prev => {
        const next = new Set(prev)
        next.add(cancelOrderId)
        return next
      })
    }
    toast({ title: 'Order Cancelled', description: `Order #${cancelOrderId} has been cancelled.` })
    setCancelOrderId(null)
  }, [cancelOrderId, storedOrders, toast])

  const handleReorder = useCallback((order: Order) => {
    const lines: CartLine[] = order.items.map((it, idx) => ({
      id: Date.now() + idx,
      name: it.name,
      price: it.price,
      image: it.image,
      quantity: it.qty,
    }))
    addToStoredCart(lines)
    toast({ title: 'Reordered!', description: `${order.items.length} item(s) added to your cart.` })
  }, [toast])

  const handleOpenAddressDialog = useCallback((addr?: Address) => {
    if (addr) {
      setEditingAddress(addr)
      setAddressDraft({ label: addr.label, name: addr.name, line1: addr.line1, line2: addr.line2, pincode: addr.pincode, phone: addr.phone })
    } else {
      setEditingAddress(null)
      setAddressDraft({ label: '', name: '', line1: '', line2: '', pincode: '', phone: '' })
    }
    setAddressDialogOpen(true)
  }, [])

  const handleSaveAddress = useCallback(() => {
    if (!addressDraft.label || !addressDraft.name || !addressDraft.line1 || !addressDraft.pincode || !addressDraft.phone) {
      toast({ title: 'Missing Fields', description: 'Please fill in all required fields.', variant: 'destructive' })
      return
    }
    if (editingAddress) {
      setAddresses(prev => prev.map(a => a.id === editingAddress.id ? { ...a, ...addressDraft } : a))
      toast({ title: 'Address Updated!', description: `${addressDraft.label} address has been updated.` })
    } else {
      setAddresses(prev => [...prev, { id: Date.now(), ...addressDraft, isDefault: prev.length === 0 }])
      toast({ title: 'Address Added!', description: `${addressDraft.label} address has been saved.` })
    }
    setAddressDialogOpen(false)
  }, [addressDraft, editingAddress, toast])

  const handleDeleteAddress = useCallback((id: number) => {
    const addr = addresses.find(a => a.id === id)
    setAddresses(prev => prev.filter(a => a.id !== id))
    toast({ title: 'Address Deleted', description: `${addr?.label || 'Address'} has been removed.` })
  }, [addresses, toast])

  const handleSetDefaultAddress = useCallback((id: number) => {
    setAddresses(prev => prev.map(a => ({ ...a, isDefault: a.id === id })))
    toast({ title: 'Default Updated', description: 'Your default delivery address has been changed.' })
  }, [toast])

  const handleProfileSave = useCallback(() => {
    setSettingsSaving(true)
    setTimeout(() => {
      persistProfile(profileForm)
      setUser(prev => ({
        ...prev,
        name: profileForm.name,
        email: profileForm.email,
        phone: profileForm.phone,
        initials: deriveInitials(profileForm.name),
      }))
      setSettingsSaving(false)
      setEditProfileOpen(false)
      toast({ title: 'Profile Updated!', description: 'Your profile changes have been saved successfully.' })
    }, 800)
  }, [toast, profileForm])

  const handlePasswordChange = () => {
    const curPass = passwordForm.current
    const newPass = passwordForm.newPass
    const confirm = passwordForm.confirm
    if (!curPass || !newPass || !confirm) {
      toast({ title: 'Missing Fields', description: 'Please fill in all password fields.', variant: 'destructive' })
      return
    }
    if (newPass !== confirm) {
      toast({ title: "Passwords Don't Match", description: 'New password and confirmation must match.', variant: 'destructive' })
      return
    }
    if (newPass.length < 6) {
      toast({ title: 'Weak Password', description: 'Password must be at least 6 characters long.', variant: 'destructive' })
      return
    }
    setPasswordDialogOpen(false)
    setPasswordForm({ current: '', newPass: '', confirm: '' })
    toast({ title: 'Password Changed!', description: 'Your password has been updated successfully.' })
  }

  const handleToggleNotif = useCallback((key: keyof NotificationSettings) => {
    setNotifSettings(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  const handleSettingsSave = useCallback(() => {
    setSettingsSaving(true)
    setTimeout(() => {
      setSettingsSaving(false)
      toast({ title: 'Settings Saved!', description: 'Your preferences have been updated.' })
    }, 800)
  }, [toast])

  // ====== TAB CONFIG ======

  const tabs = [
    { id: 'orders', label: 'Orders', icon: ShoppingBag },
    { id: 'wishlist', label: 'Wishlist', icon: Heart },
    { id: 'addresses', label: 'Addresses', icon: MapPin },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]

  // ====== RENDER SECTIONS ======

  const renderOrders = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <ShoppingBag className="h-5 w-5 text-temple-gold" />
          My <span className="gold-text">Orders</span>
        </h2>
        <Badge className="bg-temple-deep/10 text-temple-deep border-temple-deep/20 text-xs">{allOrders.length} orders</Badge>
      </div>
      <div className="space-y-3">
        {allOrders.map((order, idx) => (
          <Card
            key={order.id}
            className={`border-temple-gold/20 bg-white overflow-hidden animate-fade-in ${idx > 0 ? 'stagger-' + Math.min(idx, 5) : ''}`}
          >
            <CardContent className="p-4 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-bold text-temple-deep text-sm">#{order.id}</span>
                    {getStatusBadge(order.status)}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />{order.date}</span>
                    <span className="flex items-center gap-1"><Package className="h-3 w-3" />{order.items.length} item{order.items.length > 1 ? 's' : ''}</span>
                    <span className="font-semibold text-temple-deep">{'\u20B9'}{order.total.toLocaleString('en-IN')}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {order.status === 'Processing' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => setCancelOrderId(order.id)}
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      Cancel
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs border-temple-gold/30 hover:bg-temple-gold/10"
                    onClick={() => handleToggleOrder(order.id)}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    View Details
                    {expandedOrder === order.id ? <ChevronUp className="h-3 w-3 ml-1" /> : <ChevronDown className="h-3 w-3 ml-1" />}
                  </Button>
                </div>
              </div>

              {/* Expandable Details */}
              <div
                className={`overflow-hidden transition-all duration-500 ease-in-out ${
                  expandedOrder === order.id ? 'max-h-[900px] opacity-100 mt-4' : 'max-h-0 opacity-0'
                }`}
              >
                <Separator className="mb-4 bg-temple-gold/15" />

                {(order.customer || order.shipment) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                    {order.customer && (
                      <div className="p-3 rounded-lg bg-temple-cream/60 border border-temple-gold/15">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-temple-saffron mb-1.5 flex items-center gap-1">
                          <User className="w-3 h-3" /> Customer Details
                        </p>
                        <p className="text-sm font-semibold text-temple-deep">{order.customer.name}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Mail className="w-3 h-3" /> {order.customer.email}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" /> {order.customer.phone}</p>
                      </div>
                    )}
                    {order.shipment && (
                      <div className="p-3 rounded-lg bg-temple-cream/60 border border-temple-gold/15">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-temple-saffron mb-1.5 flex items-center gap-1">
                          <Truck className="w-3 h-3" /> Shipment Details
                        </p>
                        <p className="text-sm text-temple-deep">{order.shipment.address}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{order.shipment.city}, {order.shipment.state} \u2014 {order.shipment.pincode}</p>
                        {order.shipment.method && (
                          <p className="text-[10px] text-temple-saffron font-semibold uppercase tracking-wider mt-1">
                            {order.shipment.method === 'express' ? 'Express \u2022 1\u20132 days' : 'Standard \u2022 3\u20135 days'}
                          </p>
                        )}
                        {order.shipment.notes && (
                          <p className="text-[11px] text-temple-deep/55 mt-1 italic">Note: {order.shipment.notes}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-3">
                  {order.items.map((item, i) => (
                    <div key={i} className="flex items-center gap-3 bg-temple-cream/50 rounded-lg p-3">
                      <div className="w-12 h-12 rounded-md bg-temple-gold/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                        <img src={item.image} alt={item.name} className="w-full h-full object-cover rounded-md" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">Qty: {item.qty} &times; {'\u20B9'}{item.price}</p>
                      </div>
                      <span className="text-sm font-semibold text-temple-deep">{'\u20B9'}{item.qty * item.price}</span>
                    </div>
                  ))}
                </div>
                <OrderTrackingSteps status={order.status} />
                <div className="flex justify-end mt-4 gap-2">
                  {order.status === 'Processing' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setCancelOrderId(order.id)}
                      className="text-xs border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                    >
                      <XCircle className="h-3 w-3 mr-1" />Cancel Order
                    </Button>
                  )}
                  <Button size="sm" onClick={() => handleReorder(order)}
                    className="text-xs bg-temple-gold hover:bg-temple-brass text-white">
                    <ShoppingBag className="h-3 w-3 mr-1" />Reorder
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )

  const renderWishlist = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Heart className="h-5 w-5 text-temple-gold" />
          My <span className="gold-text">Wishlist</span>
        </h2>
        <Badge className="bg-temple-deep/10 text-temple-deep border-temple-deep/20 text-xs">{wishlist.length} items</Badge>
      </div>
      {wishlist.length === 0 ? (
        <Card className="border-temple-gold/20 bg-white">
          <CardContent className="p-12 text-center">
            <Heart className="h-12 w-12 text-temple-gold/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-temple-deep mb-2">Your wishlist is empty</h3>
            <p className="text-muted-foreground text-sm mb-4">Browse our collection and add items you love.</p>
            <Link href="/collection">
              <Button className="bg-temple-gold hover:bg-temple-brass text-white">
                <ShoppingBag className="h-4 w-4 mr-2" />Browse Collection
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {wishlist.map((item) => (
            <Card key={item.id} className="border-temple-gold/20 bg-white overflow-hidden group hover:shadow-lg hover:shadow-temple-gold/10 transition-shadow duration-300">
              <div className="relative aspect-square overflow-hidden bg-temple-cream/50">
                <img src={item.image} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                {!item.inStock && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                    <Badge className="bg-red-500/90 text-white text-xs">Out of Stock</Badge>
                  </div>
                )}
              </div>
              <CardContent className="p-4">
                <h3 className="font-semibold text-sm mb-1 group-hover:text-temple-gold transition-colors">{item.name}</h3>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-lg font-bold text-temple-deep">{'\u20B9'}{item.price}</span>
                  <span className="text-xs text-muted-foreground line-through">{'\u20B9'}{item.originalPrice}</span>
                  <Badge className="bg-temple-saffron/10 text-temple-saffron border-0 text-[10px] px-1.5">
                    {Math.round((1 - item.price / item.originalPrice) * 100)}% OFF
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className={`flex-1 text-xs ${item.inStock ? 'bg-temple-gold hover:bg-temple-brass text-white' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
                    disabled={!item.inStock}
                    onClick={() => handleMoveToCart(item)}
                  >
                    <ShoppingBag className="h-3 w-3 mr-1" />
                    {item.inStock ? 'Move to Cart' : 'Out of Stock'}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 px-2"
                    onClick={() => handleRemoveFromWishlist(item.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )

  const renderAddresses = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <MapPin className="h-5 w-5 text-temple-gold" />
          Saved <span className="gold-text">Addresses</span>
        </h2>
        <Button
          size="sm"
          className="text-xs bg-temple-gold hover:bg-temple-brass text-white"
          onClick={() => handleOpenAddressDialog()}
        >
          <Plus className="h-3 w-3 mr-1" />Add New
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {addresses.map((addr) => (
          <Card
            key={addr.id}
            className={`border-temple-gold/20 bg-white overflow-hidden relative hover:shadow-lg transition-shadow duration-300 ${
              addr.isDefault ? 'ring-2 ring-temple-gold/30' : ''
            }`}
          >
            {addr.isDefault && (
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-temple-gold to-temple-saffron" />
            )}
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {addr.label === 'Home' ? (
                    <Home className="h-4 w-4 text-temple-gold" />
                  ) : (
                    <MapPin className="h-4 w-4 text-temple-gold" />
                  )}
                  <span className="font-semibold text-sm">{addr.label}</span>
                  {addr.isDefault && (
                    <Badge className="bg-temple-gold/10 text-temple-gold border-temple-gold/20 text-[9px] px-1.5">Default</Badge>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-temple-gold"
                    onClick={() => handleOpenAddressDialog(addr)}
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-red-500"
                    onClick={() => handleDeleteAddress(addr.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="text-sm text-muted-foreground space-y-0.5">
                <p className="font-medium text-foreground">{addr.name}</p>
                <p>{addr.line1}</p>
                <p>{addr.line2} - {addr.pincode}</p>
                <p className="flex items-center gap-1 mt-1"><Phone className="h-3 w-3" />{addr.phone}</p>
              </div>
              {!addr.isDefault && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-3 text-xs border-temple-gold/30 hover:bg-temple-gold/10"
                  onClick={() => handleSetDefaultAddress(addr.id)}
                >
                  Set as Default
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
        {/* Add New Address Card */}
        <Card
          className="border-2 border-dashed border-temple-gold/30 bg-transparent hover:bg-temple-gold/5 transition-colors cursor-pointer"
          onClick={() => handleOpenAddressDialog()}
        >
          <CardContent className="p-4 flex flex-col items-center justify-center h-full min-h-[200px]">
            <div className="w-12 h-12 rounded-full bg-temple-gold/10 flex items-center justify-center mb-3">
              <Plus className="h-5 w-5 text-temple-gold" />
            </div>
            <p className="font-semibold text-sm text-temple-gold">Add New Address</p>
            <p className="text-xs text-muted-foreground mt-1">Save a new delivery location</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )

  const renderSettings = () => (
    <div className="space-y-6">
      {/* Profile Info Form */}
      <Card className="border-temple-gold/20 bg-white">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5 text-temple-gold" />
            Profile Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Full Name</Label>
              <Input
                type="text"
                value={profileForm.name}
                onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                className="mt-1 border-temple-gold/20 focus:ring-temple-gold/30"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Email</Label>
              <Input
                type="email"
                value={profileForm.email}
                onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                className="mt-1 border-temple-gold/20 focus:ring-temple-gold/30"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Phone</Label>
              <Input
                type="tel"
                value={profileForm.phone}
                onChange={(e) => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                className="mt-1 border-temple-gold/20 focus:ring-temple-gold/30"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Member Since</Label>
              <Input
                type="text"
                value={user.memberSince}
                disabled
                className="mt-1 border-temple-gold/20 bg-muted/50 cursor-not-allowed"
              />
            </div>
          </div>
          <Button className="bg-temple-gold hover:bg-temple-brass text-white" onClick={() => {
            setSettingsSaving(true)
            setTimeout(() => {
              persistProfile(profileForm)
              setUser(prev => ({
                ...prev,
                name: profileForm.name,
                email: profileForm.email,
                phone: profileForm.phone,
                initials: deriveInitials(profileForm.name),
              }))
              setSettingsSaving(false)
              toast({ title: 'Profile Updated!', description: 'Your profile information has been saved.' })
            }, 800)
          }} disabled={settingsSaving}>
            {settingsSaving ? <><span className="animate-spin mr-2">{'\u25CB'}</span>Saving...</> : <><Save className="h-4 w-4 mr-2" />Save Changes</>}
          </Button>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card className="border-temple-gold/20 bg-white">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Lock className="h-5 w-5 text-temple-gold" />
            Change Password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">Update your account password to keep your account secure.</p>
          <Button
            variant="outline"
            className="border-temple-gold/30 hover:bg-temple-gold/10"
            onClick={() => setPasswordDialogOpen(true)}
          >
            <Lock className="h-4 w-4 mr-2" />Change Password
          </Button>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card className="border-temple-gold/20 bg-white">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5 text-temple-gold" />
            Notification Preferences
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {([
            { key: 'orderUpdates' as keyof NotificationSettings, label: 'Order Updates', desc: 'Get notified about your order status changes' },
            { key: 'promoOffers' as keyof NotificationSettings, label: 'Promotional Offers', desc: 'Receive special deals and festive discounts' },
            { key: 'priceDrop' as keyof NotificationSettings, label: 'Price Drop Alerts', desc: 'Know when wishlist items go on sale' },
            { key: 'newArrivals' as keyof NotificationSettings, label: 'New Arrivals', desc: 'Be the first to know about new fragrances' },
            { key: 'loyaltyPoints' as keyof NotificationSettings, label: 'Loyalty Points Updates', desc: 'Track your points and reward milestones' },
          ]).map((setting) => (
            <div
              key={setting.key}
              className="flex items-center justify-between p-3 rounded-lg border border-temple-gold/10 hover:bg-temple-gold/5 transition-colors"
            >
              <div>
                <span className="text-sm font-medium">{setting.label}</span>
                <p className="text-xs text-muted-foreground">{setting.desc}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={notifSettings[setting.key]}
                onClick={() => handleToggleNotif(setting.key)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-temple-gold/30 ${
                  notifSettings[setting.key] ? 'bg-temple-gold' : 'bg-muted'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    notifSettings[setting.key] ? 'translate-x-[22px]' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          ))}
          <Button className="bg-temple-gold hover:bg-temple-brass text-white mt-2" onClick={handleSettingsSave} disabled={settingsSaving}>
            {settingsSaving ? <><span className="animate-spin mr-2">{'\u25CB'}</span>Saving...</> : <><Save className="h-4 w-4 mr-2" />Save Preferences</>}
          </Button>
        </CardContent>
      </Card>

      {/* Delete Account */}
      <Card className="border-red-200 bg-white">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-red-600 flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Delete Account
              </h3>
              <p className="text-sm text-muted-foreground mt-1">Permanently delete your account and all associated data. This action cannot be undone.</p>
            </div>
            <Button
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => setDeleteAccountDialogOpen(true)}
            >
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  // ====== MAIN RENDER ======

  if (!authChecked || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-temple-cream">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full border-4 border-temple-saffron border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-sm text-temple-deep/60">Loading your dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-temple-cream">
      {/* ====== TOP NAV ====== */}
      <header className="sticky top-0 z-50 deep-maroon-gradient border-b border-temple-gold/30 shadow-lg relative">
        {/* Gold accent line at top */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-temple-gold/60 to-transparent" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2 text-temple-cream hover:text-temple-gold transition-colors">
                <ArrowLeft className="h-5 w-5" />
                <span className="text-sm font-medium hidden sm:inline">Back to Shop</span>
              </Link>
              <Separator orientation="vertical" className="h-6 bg-temple-gold/30" />
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-temple-gold/20 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-temple-gold animate-diya" />
                </div>
                <span className="font-bold text-temple-cream text-lg">Shri Fragrance</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {session.role === 'admin' && (
                <Link href="/admin">
                  <Button variant="ghost" size="sm" className="text-temple-cream/80 hover:text-temple-gold hover:bg-temple-gold/10 text-xs">
                    <Store className="h-4 w-4 mr-1" />Admin
                  </Button>
                </Link>
              )}
              <Button variant="ghost" size="sm" onClick={handleLogout}
                className="text-temple-cream/80 hover:text-temple-gold hover:bg-temple-gold/10 text-xs">
                <Lock className="h-4 w-4 mr-1" /> Logout
              </Button>
              <div className="w-8 h-8 rounded-full bg-temple-gold/20 flex items-center justify-center text-temple-gold text-xs font-bold">
                {user.initials}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ====== PROFILE HEADER ====== */}
      <section className="relative overflow-hidden kolam-pattern">
        {/* Temple pattern background */}
        <div className="absolute inset-0 rangoli-dots opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-b from-temple-maroon/5 to-transparent" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card className="border-[3px] border-temple-gold/50 bg-white/95 backdrop-blur-sm shadow-xl overflow-hidden">
            {/* Gold ornamental top border */}
            <div className="h-2 bg-gradient-to-r from-temple-gold via-temple-amber to-temple-gold" />
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                {/* Avatar */}
                <div className="relative flex-shrink-0">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full border-[3px] border-temple-gold bg-gradient-to-br from-temple-gold/20 to-temple-saffron/20 flex items-center justify-center animate-glow">
                    <span className="text-2xl sm:text-3xl font-bold gold-text-static">{user.initials}</span>
                  </div>
                  {/* Diya indicator */}
                  <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-temple-gold flex items-center justify-center shadow-md">
                    <Flame className="h-3.5 w-3.5 text-white animate-diya" />
                  </div>
                </div>

                {/* User Info */}
                <div className="flex-1 text-center sm:text-left">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
                    <h1 className="text-2xl sm:text-3xl font-bold text-temple-deep">{user.name}</h1>
                    <Badge className="bg-gradient-to-r from-temple-gold to-temple-saffron text-white border-0 text-xs w-fit">
                      <Crown className="h-3 w-3 mr-1" />{user.membership}
                    </Badge>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-sm text-muted-foreground mb-3">
                    <span className="flex items-center gap-1 justify-center sm:justify-start"><Mail className="h-3.5 w-3.5" />{user.email}</span>
                    <span className="flex items-center gap-1 justify-center sm:justify-start"><CalendarDays className="h-3.5 w-3.5" />Member since {user.memberSince}</span>
                  </div>
                  <Button
                    className="bg-temple-gold hover:bg-temple-brass text-white"
                    onClick={() => setEditProfileOpen(true)}
                  >
                    <Edit3 className="h-4 w-4 mr-2" />Edit Profile
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ====== QUICK STATS ====== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {[
            { label: 'Total Orders', value: '24', icon: ShoppingBag, color: 'from-temple-gold/10 to-temple-saffron/10', iconBg: 'bg-temple-gold/20', iconColor: 'text-temple-gold' },
            { label: 'Wishlist Items', value: '8', icon: Heart, color: 'from-temple-ruby/10 to-temple-maroon/10', iconBg: 'bg-temple-ruby/20', iconColor: 'text-temple-ruby' },
            { label: 'Reward Points', value: '1,250', icon: Award, color: 'from-temple-saffron/10 to-temple-amber/10', iconBg: 'bg-temple-saffron/20', iconColor: 'text-temple-saffron' },
            { label: 'Wallet Balance', value: '\u20B9450', icon: Wallet, color: 'from-temple-deep/10 to-temple-maroon/10', iconBg: 'bg-temple-deep/20', iconColor: 'text-temple-deep' },
          ].map((stat, idx) => (
            <Card
              key={stat.label}
              className={`border-temple-gold/20 bg-gradient-to-br ${stat.color} hover:shadow-md transition-shadow duration-300 animate-fade-in stagger-${idx + 1}`}
            >
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl ${stat.iconBg} flex items-center justify-center flex-shrink-0`}>
                    <stat.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${stat.iconColor}`} />
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-lg sm:text-2xl font-bold text-temple-deep">{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* ====== TEMPLE DIVIDER ====== */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="temple-divider" />
      </div>

      {/* ====== TABS NAVIGATION + CONTENT ====== */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Custom Tab Buttons */}
        <div className="flex gap-1 sm:gap-2 mb-6 bg-temple-gold/5 rounded-xl p-1.5 overflow-x-auto">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 sm:px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-300 whitespace-nowrap flex-shrink-0 ${
                  isActive
                    ? 'bg-temple-gold text-white shadow-md shadow-temple-gold/30'
                    : 'text-muted-foreground hover:text-temple-deep hover:bg-temple-gold/10'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            )
          })}
        </div>

        {/* Tab Content */}
        <div className="animate-fade-in" key={activeTab}>
          {activeTab === 'orders' && renderOrders()}
          {activeTab === 'wishlist' && renderWishlist()}
          {activeTab === 'addresses' && renderAddresses()}
          {activeTab === 'settings' && renderSettings()}
        </div>
      </section>

      {/* ====== FOOTER ====== */}
      <footer className="mt-8 border-t border-temple-gold/20 bg-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-temple-gold" />
              <span className="text-sm font-medium text-temple-deep">Shri Fragrance</span>
            </div>
            <div className="flex items-center gap-4">
              <Link href="/" className="text-xs text-muted-foreground hover:text-temple-gold transition-colors">
                Back to Shop
              </Link>
              <Link href="/admin" className="text-xs text-muted-foreground hover:text-temple-gold transition-colors">
                Admin Panel
              </Link>
            </div>
            <p className="text-xs text-muted-foreground">{'\u00A9'} 2025 Shri Fragrance. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* ====== DIALOGS ====== */}

      {/* Edit Profile Dialog */}
      <Dialog open={editProfileOpen} onOpenChange={setEditProfileOpen}>
        <DialogContent className="bg-white border-temple-gold/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-temple-deep">
              <User className="h-5 w-5 text-temple-gold" />
              Edit Profile
            </DialogTitle>
            <DialogDescription>Update your personal information below.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Full Name</Label>
              <Input
                type="text"
                value={profileForm.name}
                onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                className="mt-1 border-temple-gold/20 focus:ring-temple-gold/30"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Email</Label>
              <Input
                type="email"
                value={profileForm.email}
                onChange={(e) => setProfileForm(prev => ({ ...prev, email: e.target.value }))}
                className="mt-1 border-temple-gold/20 focus:ring-temple-gold/30"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Phone</Label>
              <Input
                type="tel"
                value={profileForm.phone}
                onChange={(e) => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                className="mt-1 border-temple-gold/20 focus:ring-temple-gold/30"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditProfileOpen(false)} className="border-temple-gold/30">
              Cancel
            </Button>
            <Button className="bg-temple-gold hover:bg-temple-brass text-white" onClick={handleProfileSave} disabled={settingsSaving}>
              {settingsSaving ? <><span className="animate-spin mr-2">{'\u25CB'}</span>Saving...</> : <><Save className="h-4 w-4 mr-2" />Save</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Address Dialog */}
      <Dialog open={addressDialogOpen} onOpenChange={setAddressDialogOpen}>
        <DialogContent className="bg-white border-temple-gold/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-temple-deep">
              <MapPin className="h-5 w-5 text-temple-gold" />
              {editingAddress ? 'Edit Address' : 'Add New Address'}
            </DialogTitle>
            <DialogDescription>
              {editingAddress ? 'Update your address details below.' : 'Fill in the details for your new address.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Label *</Label>
                <Input
                  type="text"
                  placeholder="e.g. Home, Office"
                  value={addressDraft.label}
                  onChange={(e) => setAddressDraft(prev => ({ ...prev, label: e.target.value }))}
                  className="mt-1 border-temple-gold/20 focus:ring-temple-gold/30"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Full Name *</Label>
                <Input
                  type="text"
                  value={addressDraft.name}
                  onChange={(e) => setAddressDraft(prev => ({ ...prev, name: e.target.value }))}
                  className="mt-1 border-temple-gold/20 focus:ring-temple-gold/30"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Address Line 1 *</Label>
              <Input
                type="text"
                placeholder="Street address"
                value={addressDraft.line1}
                onChange={(e) => setAddressDraft(prev => ({ ...prev, line1: e.target.value }))}
                className="mt-1 border-temple-gold/20 focus:ring-temple-gold/30"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Address Line 2</Label>
              <Input
                type="text"
                placeholder="City, Area"
                value={addressDraft.line2}
                onChange={(e) => setAddressDraft(prev => ({ ...prev, line2: e.target.value }))}
                className="mt-1 border-temple-gold/20 focus:ring-temple-gold/30"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Pincode *</Label>
                <Input
                  type="text"
                  placeholder="600001"
                  value={addressDraft.pincode}
                  onChange={(e) => setAddressDraft(prev => ({ ...prev, pincode: e.target.value }))}
                  className="mt-1 border-temple-gold/20 focus:ring-temple-gold/30"
                />
              </div>
              <div>
                <Label className="text-xs font-medium text-muted-foreground">Phone *</Label>
                <Input
                  type="text"
                  placeholder="+91 98765 43210"
                  value={addressDraft.phone}
                  onChange={(e) => setAddressDraft(prev => ({ ...prev, phone: e.target.value }))}
                  className="mt-1 border-temple-gold/20 focus:ring-temple-gold/30"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddressDialogOpen(false)} className="border-temple-gold/30">
              Cancel
            </Button>
            <Button className="bg-temple-gold hover:bg-temple-brass text-white" onClick={handleSaveAddress}>
              <Save className="h-4 w-4 mr-2" />{editingAddress ? 'Update' : 'Save Address'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="bg-white border-temple-gold/30">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-temple-deep">
              <Lock className="h-5 w-5 text-temple-gold" />
              Change Password
            </DialogTitle>
            <DialogDescription>Enter your current password and choose a new one.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Current Password</Label>
              <Input
                type="password"
                value={passwordForm.current}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, current: e.target.value }))}
                className="mt-1 border-temple-gold/20 focus:ring-temple-gold/30"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">New Password</Label>
              <Input
                type="password"
                value={passwordForm.newPass}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, newPass: e.target.value }))}
                className="mt-1 border-temple-gold/20 focus:ring-temple-gold/30"
              />
            </div>
            <div>
              <Label className="text-xs font-medium text-muted-foreground">Confirm New Password</Label>
              <Input
                type="password"
                value={passwordForm.confirm}
                onChange={(e) => setPasswordForm(prev => ({ ...prev, confirm: e.target.value }))}
                className="mt-1 border-temple-gold/20 focus:ring-temple-gold/30"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)} className="border-temple-gold/30">
              Cancel
            </Button>
            <Button className="bg-temple-gold hover:bg-temple-brass text-white" onClick={handlePasswordChange}>
              Update Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Order Confirmation Dialog */}
      <Dialog open={!!cancelOrderId} onOpenChange={(open) => !open && setCancelOrderId(null)}>
        <DialogContent className="bg-white border-red-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <XCircle className="h-5 w-5" />
              Cancel Order
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel order #{cancelOrderId}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOrderId(null)} className="border-temple-gold/30">
              Keep Order
            </Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={handleConfirmCancel}>
              <XCircle className="h-4 w-4 mr-2" />Yes, Cancel Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirmation Dialog */}
      <Dialog open={deleteAccountDialogOpen} onOpenChange={setDeleteAccountDialogOpen}>
        <DialogContent className="bg-white border-red-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Shield className="h-5 w-5" />
              Delete Account
            </DialogTitle>
            <DialogDescription>
              This action is permanent and cannot be undone. All your data, orders, and rewards will be permanently deleted.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-red-50 rounded-lg p-4 my-2">
            <p className="text-sm text-red-700 font-medium">Are you absolutely sure you want to delete your account?</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAccountDialogOpen(false)} className="border-temple-gold/30">
              Cancel
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => {
                try {
                  localStorage.removeItem(PROFILE_KEY)
                  localStorage.removeItem(CART_KEY)
                  localStorage.removeItem(ORDERS_KEY)
                } catch { /* storage unavailable */ }
                setUser(userData)
                setProfileForm({ name: userData.name, email: userData.email, phone: userData.phone })
                setStoredOrders([])
                setDeleteAccountDialogOpen(false)
                toast({ title: 'Account Deleted', description: 'Your local account data has been cleared.' })
              }}
            >
              Yes, Delete My Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
