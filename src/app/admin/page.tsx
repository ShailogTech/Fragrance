"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { ensureAdminSeed, getSession, logout as authLogout, subscribeAuth, type Session, type StoredUser, USERS_KEY } from "@/lib/auth";
import { fetchAllOrders, setOrderStatus, type StoredOrder } from "@/lib/orders";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  LayoutDashboard, Package, ShoppingCart, Users, BarChart3,
  Settings, Menu, X, Bell, Search, TrendingUp, TrendingDown,
  IndianRupee, ChevronDown, Landmark, Flame, Sparkles,
  ArrowUpRight, ArrowDownRight, MoreHorizontal, Eye,
  ArrowLeft, Home, Plus, Edit3, Trash2, Filter,
  DollarSign, Star, Clock, CheckCircle2, XCircle,
  Truck, AlertCircle, RefreshCw, Download, Upload,
  Save, Mail, Phone, MapPin, Calendar, Tag, Percent,
  BarChart2, PieChart, Activity, TrendingUp as TrendIcon,
  UserPlus, Shield, Lock, BellRing, Globe, Palette,
} from "lucide-react";
import { adminProductsSeed as productsList, fetchCatalog, saveCatalog } from "@/lib/catalog";

// ── Color Palette ──────────────────────────────────────
const colors = {
  maroon: "#800020",
  saffron: "#FF6F00",
  templeGold: "#D4AF37",
  warmCream: "#FFF8E7",
  deep: "#1A0A2E",
};

// ── Mock Data ──────────────────────────────────────────
const statsData = [
  { title: "Total Revenue", value: "₹12,45,678", change: "+12.5%", trend: "up" as const, icon: IndianRupee },
  { title: "Orders", value: "1,234", change: "+8.2%", trend: "up" as const, icon: ShoppingCart },
  { title: "Customers", value: "5,678", change: "+3.1%", trend: "up" as const, icon: Users },
  { title: "Conversion Rate", value: "3.2%", change: "-0.4%", trend: "down" as const, icon: BarChart3 },
];

const monthlyRevenue = [
  { month: "Jan", value: 65000 }, { month: "Feb", value: 72000 }, { month: "Mar", value: 85000 },
  { month: "Apr", value: 78000 }, { month: "May", value: 92000 }, { month: "Jun", value: 105000 },
  { month: "Jul", value: 98000 }, { month: "Aug", value: 112000 }, { month: "Sep", value: 120000 },
  { month: "Oct", value: 115000 }, { month: "Nov", value: 130000 }, { month: "Dec", value: 142000 },
];

const orderCategories = [
  { label: "Incense", value: 35, color: colors.saffron },
  { label: "Oils", value: 25, color: colors.templeGold },
  { label: "Puja Kits", value: 20, color: colors.maroon },
  { label: "Dhoop", value: 12, color: "#C2185B" },
  { label: "Others", value: 8, color: colors.deep },
];

const recentOrders = [
  { id: "ORD-7892", customer: "Rajesh Kumar", product: "Chandan Premium Incense", amount: "₹2,450", status: "Delivered", date: "2024-01-15" },
  { id: "ORD-7891", customer: "Priya Sharma", product: "Sandalwood Oil 50ml", amount: "₹1,890", status: "Processing", date: "2024-01-15" },
  { id: "ORD-7890", customer: "Arun Iyer", product: "Temple Puja Kit", amount: "₹3,200", status: "Shipped", date: "2024-01-14" },
  { id: "ORD-7889", customer: "Meena Nair", product: "Jasmine Dhoop Sticks", amount: "₹650", status: "Delivered", date: "2024-01-14" },
  { id: "ORD-7888", customer: "Vikram Patel", product: "Frankincense Resin", amount: "₹1,100", status: "Cancelled", date: "2024-01-13" },
  { id: "ORD-7887", customer: "Lakshmi Reddy", product: "Rose Attar Perfume", amount: "₹4,500", status: "Delivered", date: "2024-01-13" },
  { id: "ORD-7886", customer: "Suresh Menon", product: "Agarbatti Variety Pack", amount: "₹780", status: "Processing", date: "2024-01-12" },
  { id: "ORD-7885", customer: "Kavitha Iyengar", product: "Camphor Tablets Box", amount: "₹320", status: "Shipped", date: "2024-01-12" },
];

const topProducts = [
  { name: "Chandan Premium Incense", sales: 342, revenue: 83900, maxRevenue: 83900 },
  { name: "Sandalwood Oil 50ml", sales: 278, revenue: 52500, maxRevenue: 83900 },
  { name: "Temple Puja Kit", sales: 195, revenue: 62400, maxRevenue: 83900 },
  { name: "Jasmine Dhoop Sticks", sales: 412, revenue: 26800, maxRevenue: 83900 },
  { name: "Rose Attar Perfume", sales: 156, revenue: 70200, maxRevenue: 83900 },
];

const customerAnalytics = [
  { month: "Jan", new: 120, returning: 340 }, { month: "Feb", new: 145, returning: 380 },
  { month: "Mar", new: 160, returning: 420 }, { month: "Apr", new: 135, returning: 390 },
  { month: "May", new: 180, returning: 450 }, { month: "Jun", new: 210, returning: 510 },
  { month: "Jul", new: 195, returning: 480 }, { month: "Aug", new: 230, returning: 540 },
  { month: "Sep", new: 250, returning: 580 }, { month: "Oct", new: 240, returning: 560 },
  { month: "Nov", new: 270, returning: 620 }, { month: "Dec", new: 300, returning: 680 },
];


const customersList = [
  { id: 1, name: "Rajesh Kumar", email: "rajesh@email.com", orders: 12, spent: "₹18,450", location: "Chennai", joined: "Jan 2023", status: "Active" },
  { id: 2, name: "Priya Sharma", email: "priya@email.com", orders: 24, spent: "₹45,200", location: "Mumbai", joined: "Mar 2022", status: "VIP" },
  { id: 3, name: "Arun Iyer", email: "arun@email.com", orders: 8, spent: "₹9,800", location: "Bangalore", joined: "Aug 2023", status: "Active" },
  { id: 4, name: "Meena Nair", email: "meena@email.com", orders: 3, spent: "₹2,150", location: "Kochi", joined: "Nov 2023", status: "New" },
  { id: 5, name: "Vikram Patel", email: "vikram@email.com", orders: 1, spent: "₹1,100", location: "Ahmedabad", joined: "Dec 2023", status: "Inactive" },
  { id: 6, name: "Lakshmi Reddy", email: "lakshmi@email.com", orders: 18, spent: "₹32,600", location: "Hyderabad", joined: "Feb 2022", status: "VIP" },
];

const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", key: "dashboard" },
  { icon: Package, label: "Products", key: "products" },
  { icon: ShoppingCart, label: "Orders", key: "orders" },
  { icon: Users, label: "Customers", key: "customers" },
  { icon: BarChart3, label: "Analytics", key: "analytics" },
  { icon: Settings, label: "Settings", key: "settings" },
];

const bottomNavItems = [
  { icon: Home, label: "Back to Home", href: "/" },
];

// ── SVG Bar Chart ──────────────────────────────────────
function BarChart() {
  const maxVal = Math.max(...monthlyRevenue.map((d) => d.value));
  const chartW = 700;
  const chartH = 240;
  const barW = 36;
  const gap = (chartW - monthlyRevenue.length * barW) / (monthlyRevenue.length + 1);

  return (
    <svg viewBox={`0 0 ${chartW} ${chartH + 40}`} className="w-full h-auto">
      {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
        const y = chartH - pct * chartH;
        const val = Math.round((maxVal * pct) / 1000);
        return (
          <g key={i}>
            <line x1={0} y1={y} x2={chartW} y2={y} stroke="#e5e0d5" strokeWidth={0.5} strokeDasharray="4,4" />
            <text x={0} y={y - 4} fontSize={10} fill="#888" textAnchor="start">{val}k</text>
          </g>
        );
      })}
      {monthlyRevenue.map((d, i) => {
        const x = gap + i * (barW + gap);
        const barH = (d.value / maxVal) * chartH;
        const y = chartH - barH;
        return (
          <g key={i}>
            <rect x={x} y={y} width={barW} height={barH} rx={4} fill="url(#barGrad)" className="transition-all duration-300 hover:opacity-80" />
            <text x={x + barW / 2} y={chartH + 16} fontSize={10} fill="#666" textAnchor="middle">{d.month}</text>
          </g>
        );
      })}
      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colors.saffron} />
          <stop offset="100%" stopColor={colors.maroon} />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ── SVG Donut Chart ────────────────────────────────────
function DonutChart() {
  const total = orderCategories.reduce((s, c) => s + c.value, 0);
  const cx = 120, cy = 120, r = 80, strokeW = 30;
  const circumference = 2 * Math.PI * r;
  const segments = orderCategories.reduce<{ color: string; dashLen: number; offset: number }[]>((acc, cat) => {
    const pct = cat.value / total;
    const dashLen = pct * circumference;
    const offset = acc.length > 0 ? acc[acc.length - 1].offset + acc[acc.length - 1].dashLen : 0;
    acc.push({ color: cat.color, dashLen, offset });
    return acc;
  }, []);

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 240 240" className="w-48 h-48 shrink-0">
        {segments.map((seg, i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={seg.color} strokeWidth={strokeW}
            strokeDasharray={`${seg.dashLen} ${circumference - seg.dashLen}`} strokeDashoffset={-seg.offset}
            transform={`rotate(-90 ${cx} ${cy})`} className="transition-all duration-500" />
        ))}
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize={22} fontWeight="bold" fill={colors.deep}>{total}%</text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize={11} fill="#888">Total</text>
      </svg>
      <div className="flex flex-col gap-2">
        {orderCategories.map((cat, i) => (
          <div key={i} className="flex items-center gap-2 text-sm">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
            <span className="text-gray-600">{cat.label}</span>
            <span className="font-semibold ml-auto" style={{ color: cat.color }}>{cat.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── SVG Area Chart ──────────────────────────────────────
function AreaChart() {
  const maxVal = Math.max(...customerAnalytics.map((d) => d.new + d.returning));
  const chartW = 600, chartH = 200, padX = 30, padY = 10;
  const plotW = chartW - padX * 2, plotH = chartH - padY * 2;
  const toPoint = (idx: number, val: number) => ({
    x: padX + (idx / (customerAnalytics.length - 1)) * plotW,
    y: padY + plotH - (val / maxVal) * plotH,
  });
  const returningPoints = customerAnalytics.map((d, i) => toPoint(i, d.returning));
  const newPoints = customerAnalytics.map((d, i) => toPoint(i, d.new));
  const toPathD = (pts: { x: number; y: number }[]) => pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const toAreaD = (pts: { x: number; y: number }[]) => `${toPathD(pts)} L${pts[pts.length - 1].x},${padY + plotH} L${pts[0].x},${padY + plotH} Z`;

  return (
    <svg viewBox={`0 0 ${chartW} ${chartH + 30}`} className="w-full h-auto">
      {[0, 0.5, 1].map((pct, i) => {
        const y = padY + plotH - pct * plotH;
        return <line key={i} x1={padX} y1={y} x2={chartW - padX} y2={y} stroke="#e5e0d5" strokeWidth={0.5} strokeDasharray="4,4" />;
      })}
      <path d={toAreaD(returningPoints)} fill={`${colors.maroon}15`} />
      <path d={toPathD(returningPoints)} fill="none" stroke={colors.maroon} strokeWidth={2} />
      <path d={toAreaD(newPoints)} fill={`${colors.saffron}20`} />
      <path d={toPathD(newPoints)} fill="none" stroke={colors.saffron} strokeWidth={2} />
      {returningPoints.map((p, i) => <circle key={`r${i}`} cx={p.x} cy={p.y} r={3} fill={colors.maroon} />)}
      {newPoints.map((p, i) => <circle key={`n${i}`} cx={p.x} cy={p.y} r={3} fill={colors.saffron} />)}
      {customerAnalytics.map((d, i) => {
        const x = padX + (i / (customerAnalytics.length - 1)) * plotW;
        return <text key={i} x={x} y={chartH + 16} fontSize={9} fill="#888" textAnchor="middle">{d.month}</text>;
      })}
    </svg>
  );
}

// ── Status Badge ───────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; icon?: React.ReactNode }> = {
    Delivered: { bg: "bg-emerald-100", text: "text-emerald-700", icon: <CheckCircle2 className="w-3 h-3 mr-1" /> },
    Processing: { bg: "bg-amber-100", text: "text-amber-700", icon: <Clock className="w-3 h-3 mr-1" /> },
    Shipped: { bg: "bg-sky-100", text: "text-sky-700", icon: <Truck className="w-3 h-3 mr-1" /> },
    Cancelled: { bg: "bg-red-100", text: "text-red-700", icon: <XCircle className="w-3 h-3 mr-1" /> },
  };
  const s = map[status] ?? { bg: "bg-gray-100", text: "text-gray-700" };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${s.bg} ${s.text}`}>{s.icon}{status}</span>;
}

function ProductStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    Active: { bg: "bg-emerald-100", text: "text-emerald-700" },
    "Low Stock": { bg: "bg-amber-100", text: "text-amber-700" },
    "Out of Stock": { bg: "bg-red-100", text: "text-red-700" },
  };
  const s = map[status] ?? { bg: "bg-gray-100", text: "text-gray-700" };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${s.bg} ${s.text}`}>{status}</span>;
}

function CustomerStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    VIP: { bg: "bg-amber-100", text: "text-amber-700" },
    Active: { bg: "bg-emerald-100", text: "text-emerald-700" },
    New: { bg: "bg-sky-100", text: "text-sky-700" },
    Inactive: { bg: "bg-gray-100", text: "text-gray-500" },
  };
  const s = map[status] ?? { bg: "bg-gray-100", text: "text-gray-700" };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${s.bg} ${s.text}`}>{status}</span>;
}

// ── Main Page ──────────────────────────────────────────
export default function AdminDashboard() {
  const { toast } = useToast();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    ensureAdminSeed();
    const refresh = () => {
      const s = getSession();
      setSession(s);
      setAuthChecked(true);
      if (!s) router.replace('/login?next=/admin');
      else if (s.role !== 'admin') router.replace('/dashboard');
    };
    refresh();
    return subscribeAuth(refresh);
  }, [router]);

  const handleLogout = useCallback(() => {
    authLogout();
    router.replace('/login');
  }, [router]);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeNav, setActiveNav] = useState("dashboard");
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [orderFilter, setOrderFilter] = useState("All");

  // ── SETTINGS STATE ──────────────────────────────────
  const [general, setGeneral] = useState({
    storeName: "Shri Fragrance",
    storeEmail: "admin@shrifragrance.com",
    currency: "INR (₹)",
    timezone: "Asia/Kolkata (IST)",
  });
  const [themeColor, setThemeColor] = useState<"maroon" | "templeGold" | "saffron">("maroon");
  const [darkMode, setDarkMode] = useState(false);
  const [notifs, setNotifs] = useState([
    { label: "New Order Alerts", desc: "Get notified for every new order", enabled: true },
    { label: "Low Stock Warnings", desc: "Alert when products fall below threshold", enabled: true },
    { label: "Customer Reviews", desc: "Notifications for new product reviews", enabled: false },
    { label: "Revenue Milestones", desc: "Celebrate revenue achievements", enabled: true },
  ]);
  const [pwd, setPwd] = useState({ current: "", next: "" });

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const g = localStorage.getItem("shri:admin:general");
      if (g) setGeneral(JSON.parse(g));
      const a = localStorage.getItem("shri:admin:appearance");
      if (a) {
        const parsed = JSON.parse(a);
        if (parsed.themeColor) setThemeColor(parsed.themeColor);
        if (typeof parsed.darkMode === "boolean") setDarkMode(parsed.darkMode);
      }
      const n = localStorage.getItem("shri:admin:notifs");
      if (n) setNotifs(JSON.parse(n));
    } catch { /* ignore */ }
  }, []);

  // Reflect dark mode on the admin root
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle("admin-dark", darkMode);
  }, [darkMode]);

  const saveGeneral = useCallback(() => {
    try { localStorage.setItem("shri:admin:general", JSON.stringify(general)); } catch {}
    toast({ title: "Settings saved", description: "General settings updated." });
  }, [general, toast]);

  const persistAppearance = useCallback((next: { themeColor?: typeof themeColor; darkMode?: boolean }) => {
    const merged = { themeColor: next.themeColor ?? themeColor, darkMode: next.darkMode ?? darkMode };
    try { localStorage.setItem("shri:admin:appearance", JSON.stringify(merged)); } catch {}
  }, [themeColor, darkMode]);

  const pickTheme = useCallback((c: typeof themeColor) => {
    setThemeColor(c);
    persistAppearance({ themeColor: c });
    toast({ title: "Theme updated", description: `Primary color set to ${c}.` });
  }, [persistAppearance, toast]);

  const toggleDark = useCallback(() => {
    setDarkMode(prev => {
      const next = !prev;
      persistAppearance({ darkMode: next });
      return next;
    });
  }, [persistAppearance]);

  const toggleNotif = useCallback((i: number) => {
    setNotifs(prev => {
      const next = prev.map((n, idx) => idx === i ? { ...n, enabled: !n.enabled } : n);
      try { localStorage.setItem("shri:admin:notifs", JSON.stringify(next)); } catch {}
      return next;
    });
  }, []);

  const updatePassword = useCallback(() => {
    if (!pwd.current || !pwd.next) {
      toast({ title: "Missing fields", description: "Enter both current and new password." });
      return;
    }
    if (pwd.next.length < 6) {
      toast({ title: "Password too short", description: "Use at least 6 characters." });
      return;
    }
    setPwd({ current: "", next: "" });
    toast({ title: "Password updated", description: "Your password has been changed." });
  }, [pwd, toast]);

  // ── PRODUCTS / ORDERS / CUSTOMERS STATE ─────────────
  type AdminProduct = typeof productsList[number] & { image?: string };
  const [products, setProducts] = useState<AdminProduct[]>(productsList);
  const [productSearch, setProductSearch] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AdminProduct | null>(null);
  const [productDraft, setProductDraft] = useState({ name: "", category: "", price: "", stock: "", image: "" });
  const [adminOrders, setAdminOrders] = useState<StoredOrder[]>([]);
  const [signedUpCustomers, setSignedUpCustomers] = useState<StoredUser[]>([]);
  const [orderDetail, setOrderDetail] = useState<StoredOrder | null>(null);

  const refreshOrders = useCallback(() => {
    void fetchAllOrders().then(setAdminOrders);
  }, []);

  const refreshCustomers = useCallback(() => {
    try {
      const raw = localStorage.getItem(USERS_KEY);
      if (!raw) { setSignedUpCustomers([]); return; }
      const parsed = JSON.parse(raw) as StoredUser[];
      setSignedUpCustomers(Array.isArray(parsed) ? parsed.filter(u => u.role === 'customer') : []);
    } catch { setSignedUpCustomers([]); }
  }, []);

  useEffect(() => {
    void fetchCatalog().then(list => setProducts(list as AdminProduct[]));
    refreshOrders();
    refreshCustomers();
    const onStorage = () => { refreshOrders(); refreshCustomers(); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refreshOrders, refreshCustomers]);

  const persistProducts = useCallback((list: AdminProduct[]) => {
    setProducts(list);
    saveCatalog(list);
  }, []);

  const handleDeleteProduct = useCallback((id: number) => {
    persistProducts(products.filter(p => p.id !== id));
    toast({ title: "Product deleted" });
  }, [products, persistProducts, toast]);

  const openAddProduct = useCallback(() => {
    setEditingProduct(null);
    setProductDraft({ name: "", category: "", price: "", stock: "", image: "" });
    setProductDialogOpen(true);
  }, []);

  const openEditProduct = useCallback((p: AdminProduct) => {
    setEditingProduct(p);
    setProductDraft({ name: p.name, category: p.category, price: String(p.price), stock: String(p.stock), image: p.image || "" });
    setProductDialogOpen(true);
  }, []);

  const handleImageFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast({ title: "Invalid file", description: "Please choose an image file." }); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const max = 400;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, w, h);
        setProductDraft(d => ({ ...d, image: canvas.toDataURL("image/jpeg", 0.8) }));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }, [toast]);

  const handleSaveProduct = useCallback(() => {
    const name = productDraft.name.trim();
    if (!name) { toast({ title: "Name required" }); return; }
    const stock = parseInt(productDraft.stock, 10) || 0;
    const status = stock === 0 ? "Out of Stock" : stock < 20 ? "Low Stock" : "Active";
    let next: AdminProduct[];
    if (editingProduct) {
      next = products.map(p => p.id === editingProduct.id
        ? { ...p, name, category: productDraft.category || p.category, price: productDraft.price || p.price, stock, status, image: productDraft.image || p.image }
        : p);
    } else {
      const id = products.reduce((m, p) => Math.max(m, p.id), 0) + 1;
      next = [{ id, name, category: productDraft.category || "Others", price: productDraft.price || "₹0", stock, status, sales: 0, rating: 0, image: productDraft.image }, ...products];
    }
    persistProducts(next);
    setProductDialogOpen(false);
    toast({ title: editingProduct ? "Product updated" : "Product added", description: `${name} saved.` });
  }, [productDraft, editingProduct, products, persistProducts, toast]);

  const updateOrderStatus = useCallback((id: string, status: string) => {
    setOrderStatus(id, status);
    setAdminOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));
    toast({ title: `Order ${id} → ${status}` });
  }, [toast]);

  const downloadCSV = useCallback((filename: string, rows: (string | number)[][]) => {
    const csv = rows.map(r => r.map(v => {
      const s = String(v ?? "").replace(/"/g, '""');
      return /[",\n]/.test(s) ? `"${s}"` : s;
    }).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }, []);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  }, [products, productSearch]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return signedUpCustomers;
    return signedUpCustomers.filter(c => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  }, [signedUpCustomers, customerSearch]);

  // Compute per-customer order stats for display.
  const customerStats = useMemo(() => {
    const map = new Map<string, { orders: number; spent: number }>();
    for (const o of adminOrders) {
      const email = o.customer?.email?.toLowerCase();
      if (!email) continue;
      const prev = map.get(email) ?? { orders: 0, spent: 0 };
      map.set(email, { orders: prev.orders + 1, spent: prev.spent + o.total });
    }
    return map;
  }, [adminOrders]);

  const dashboardStats = useMemo(() => {
    const totalRevenue = adminOrders.reduce((s, o) => s + o.total, 0);
    const processing = adminOrders.filter(o => o.status === 'Processing').length;
    const shipped = adminOrders.filter(o => o.status === 'Shipped').length;
    const delivered = adminOrders.filter(o => o.status === 'Delivered').length;
    return {
      totalRevenue, totalOrders: adminOrders.length,
      totalCustomers: signedUpCustomers.length,
      processing, shipped, delivered,
    };
  }, [adminOrders, signedUpCustomers]);

  // ── SECTION RENDERERS ──────────────────────────────

  const renderDashboard = () => (
    <>
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: colors.deep }}>Dashboard</h2>
          <p className="text-sm text-gray-500 mt-0.5">Welcome back, Shri Admin. Here&apos;s your overview.</p>
        </div>
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium gold-glow"
          style={{ backgroundColor: `${colors.templeGold}12`, color: colors.maroon }}>
          <Sparkles className="w-3.5 h-3.5" /> Navratri Season Active
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Total Revenue", value: `₹${dashboardStats.totalRevenue.toLocaleString('en-IN')}`, icon: IndianRupee },
          { title: "Orders", value: String(dashboardStats.totalOrders), icon: ShoppingCart },
          { title: "Customers", value: String(dashboardStats.totalCustomers), icon: Users },
          { title: "Active Products", value: String(products.filter(p => p.status === 'Active').length), icon: Package },
        ].map((stat, i) => {
          const gradients = ["stat-gradient-revenue", "stat-gradient-orders", "stat-gradient-customers", "stat-gradient-conversion"];
          const iconBgs = [colors.saffron, colors.maroon, colors.templeGold, colors.deep];
          const delayClass = `card-enter-${i + 1}`;
          return (
            <Card key={stat.title} className={`card-enter ${delayClass} border-0 shadow-md hover:shadow-lg transition-shadow duration-300`}
              style={{ borderTop: `3px solid ${iconBgs[i]}` }}>
              <CardContent className={`p-5 rounded-xl ${gradients[i]}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: iconBgs[i], color: colors.warmCream }}>
                    <stat.icon className="w-5 h-5" />
                  </div>
                </div>
                <p className="text-2xl font-bold" style={{ color: colors.deep }}>{stat.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{stat.title}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border shadow-md card-enter" style={{ borderColor: `${colors.templeGold}20` }}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base" style={{ color: colors.deep }}>Revenue Overview</CardTitle>
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <TrendingUp className="w-3.5 h-3.5" style={{ color: colors.saffron }} /> +18.2% vs last year
              </div>
            </div>
          </CardHeader>
          <CardContent><BarChart /></CardContent>
        </Card>
        <Card className="border shadow-md card-enter" style={{ borderColor: `${colors.templeGold}20` }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base" style={{ color: colors.deep }}>Order Distribution</CardTitle>
          </CardHeader>
          <CardContent><DonutChart /></CardContent>
        </Card>
      </div>

      {/* Orders Table & Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border shadow-md card-enter" style={{ borderColor: `${colors.templeGold}20` }}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base" style={{ color: colors.deep }}>Recent Orders</CardTitle>
              <Button variant="ghost" size="sm" className="text-xs gap-1" style={{ color: colors.saffron }} onClick={() => setActiveNav("orders")}>
                <Eye className="w-3.5 h-3.5" /> View All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ borderColor: `${colors.templeGold}15` }}>
                    <th className="px-6 py-3">Order ID</th><th className="px-6 py-3">Customer</th><th className="px-6 py-3 hidden md:table-cell">Product</th>
                    <th className="px-6 py-3">Amount</th><th className="px-6 py-3">Status</th><th className="px-6 py-3 hidden sm:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {adminOrders.slice(0, 5).map((order) => (
                    <tr key={order.id} className="border-b hover:bg-gray-50/60 transition-colors" style={{ borderColor: `${colors.templeGold}10` }}>
                      <td className="px-6 py-3 font-medium" style={{ color: colors.deep }}>{order.id}</td>
                      <td className="px-6 py-3 text-gray-700">{order.customer?.name ?? '—'}</td>
                      <td className="px-6 py-3 text-gray-500 hidden md:table-cell max-w-[180px] truncate">{order.items.map(i => i.name).join(', ')}</td>
                      <td className="px-6 py-3 font-medium" style={{ color: colors.deep }}>₹{order.total}</td>
                      <td className="px-6 py-3"><StatusBadge status={order.status} /></td>
                      <td className="px-6 py-3 text-gray-400 hidden sm:table-cell">{order.date}</td>
                    </tr>
                  ))}
                  {adminOrders.length === 0 && (
                    <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-400 text-xs">No orders yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        <Card className="border shadow-md card-enter" style={{ borderColor: `${colors.templeGold}20` }}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base" style={{ color: colors.deep }}>Top Products</CardTitle>
              <Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="w-4 h-4 text-gray-400" /></Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {(() => {
              const top = [...products].sort((a, b) => b.sales - a.sales).slice(0, 5);
              const maxSales = Math.max(1, ...top.map(p => p.sales));
              return top.map((product, i) => (
                <div key={product.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700 truncate pr-2">{product.name}</span>
                    <span className="text-xs font-semibold shrink-0" style={{ color: colors.saffron }}>{product.price}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${(product.sales / maxSales) * 100}%`, background: `linear-gradient(90deg, ${colors.saffron}, ${colors.templeGold})` }} />
                    </div>
                    <span className="text-xs text-gray-400 shrink-0 w-14 text-right">{product.sales} sold</span>
                  </div>
                </div>
              ));
            })()}
          </CardContent>
        </Card>
      </div>

      {/* Customer Analytics */}
      <Card className="border shadow-md card-enter" style={{ borderColor: `${colors.templeGold}20` }}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base" style={{ color: colors.deep }}>Customer Analytics</CardTitle>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: colors.maroon }} />Returning</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: colors.saffron }} />New</span>
            </div>
          </div>
        </CardHeader>
        <CardContent><AreaChart /></CardContent>
      </Card>
    </>
  );

  const renderProducts = () => (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: colors.deep }}>Products</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage your product inventory and catalog</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadCSV(
            'products.csv',
            [['ID','Name','Category','Price','Stock','Status','Sales','Rating'],
            ...products.map(p => [p.id, p.name, p.category, p.price, p.stock, p.status, p.sales, p.rating])]
          )} className="text-xs gap-1" style={{ borderColor: `${colors.templeGold}30` }}>
            <Download className="w-3.5 h-3.5" /> Export
          </Button>
          <Button size="sm" onClick={openAddProduct} className="text-xs gap-1 text-white" style={{ backgroundColor: colors.maroon }}>
            <Plus className="w-3.5 h-3.5" /> Add Product
          </Button>
        </div>
      </div>

      {/* Product Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Total Products", value: String(products.length), icon: Package, color: colors.saffron },
          { label: "Active", value: String(products.filter(p => p.status === 'Active').length), icon: CheckCircle2, color: "#16a34a" },
          { label: "Low Stock", value: String(products.filter(p => p.status === 'Low Stock').length), icon: AlertCircle, color: colors.saffron },
          { label: "Out of Stock", value: String(products.filter(p => p.status === 'Out of Stock').length), icon: XCircle, color: colors.maroon },
        ].map((s, i) => (
          <Card key={i} className="border shadow-sm card-enter" style={{ borderColor: `${colors.templeGold}20` }}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${s.color}15`, color: s.color }}>
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xl font-bold" style={{ color: colors.deep }}>{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Products Table */}
      <Card className="border shadow-md" style={{ borderColor: `${colors.templeGold}20` }}>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-base" style={{ color: colors.deep }}>Product Catalog</CardTitle>
            <div className="flex items-center gap-2">
              <Input placeholder="Search products..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)}
                className="h-8 text-xs w-48" style={{ borderColor: `${colors.templeGold}30` }} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ borderColor: `${colors.templeGold}15` }}>
                  <th className="px-6 py-3">Product</th>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3">Price</th>
                  <th className="px-6 py-3">Stock</th>
                  <th className="px-6 py-3">Sales</th>
                  <th className="px-6 py-3">Rating</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} className="border-b hover:bg-gray-50/60 transition-colors" style={{ borderColor: `${colors.templeGold}10` }}>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-2">
                        {product.image ? (
                          <img src={product.image} alt={product.name} className="w-8 h-8 rounded-md object-cover border" style={{ borderColor: `${colors.templeGold}25` }} />
                        ) : (
                          <span className="w-8 h-8 rounded-md flex items-center justify-center" style={{ backgroundColor: `${colors.templeGold}15` }}>
                            <Package className="w-3.5 h-3.5" style={{ color: colors.saffron }} />
                          </span>
                        )}
                        <span className="font-medium" style={{ color: colors.deep }}>{product.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-gray-500">{product.category}</td>
                    <td className="px-6 py-3 font-medium" style={{ color: colors.deep }}>{product.price}</td>
                    <td className="px-6 py-3">
                      <span className={product.stock === 0 ? "text-red-500 font-medium" : product.stock < 20 ? "text-amber-600 font-medium" : "text-gray-700"}>
                        {product.stock}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-gray-600">{product.sales}</td>
                    <td className="px-6 py-3">
                      <span className="flex items-center gap-1 text-amber-600 font-medium">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />{product.rating}
                      </span>
                    </td>
                    <td className="px-6 py-3"><ProductStatusBadge status={product.status} /></td>
                    <td className="px-6 py-3">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEditProduct(product)} className="h-7 w-7 hover:bg-amber-50"><Edit3 className="w-3.5 h-3.5" style={{ color: colors.saffron }} /></Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteProduct(product.id)} className="h-7 w-7 hover:bg-red-50"><Trash2 className="w-3.5 h-3.5 text-red-400" /></Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredProducts.length === 0 && (
                  <tr><td colSpan={8} className="px-6 py-10 text-center text-gray-400 text-xs">No products match your search.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );

  const renderOrders = () => {
    const filtered = orderFilter === "All" ? adminOrders : adminOrders.filter(o => o.status === orderFilter);
    return (
      <>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold" style={{ color: colors.deep }}>Orders</h2>
            <p className="text-sm text-gray-500 mt-0.5">Track and manage customer orders ({adminOrders.length} total)</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => downloadCSV(
              'orders.csv',
              [['Order ID','Customer','Email','Phone','Items','Total','Status','Date','Address'],
              ...adminOrders.map(o => [
                o.id,
                o.customer?.name ?? '',
                o.customer?.email ?? '',
                o.customer?.phone ?? '',
                o.items.map(i => `${i.name} x${i.quantity}`).join('; '),
                o.total,
                o.status,
                o.date,
                o.shipment ? `${o.shipment.address}, ${o.shipment.city}, ${o.shipment.state} - ${o.shipment.pincode}` : '',
              ])]
            )} className="text-xs gap-1" style={{ borderColor: `${colors.templeGold}30` }}>
              <Download className="w-3.5 h-3.5" /> Export
            </Button>
            <Button size="sm" onClick={refreshOrders} className="text-xs gap-1 text-white" style={{ backgroundColor: colors.maroon }}>
              <RefreshCw className="w-3.5 h-3.5" /> Refresh
            </Button>
          </div>
        </div>

        {/* Order Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: "Total Orders", value: String(dashboardStats.totalOrders), icon: ShoppingCart, color: colors.saffron },
            { label: "Processing", value: String(dashboardStats.processing), icon: Clock, color: colors.saffron },
            { label: "Shipped", value: String(dashboardStats.shipped), icon: Truck, color: "#0284c7" },
            { label: "Delivered", value: String(dashboardStats.delivered), icon: CheckCircle2, color: "#16a34a" },
          ].map((s, i) => (
            <Card key={i} className="border shadow-sm card-enter" style={{ borderColor: `${colors.templeGold}20` }}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${s.color}15`, color: s.color }}>
                  <s.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xl font-bold" style={{ color: colors.deep }}>{s.value}</p>
                  <p className="text-xs text-gray-500">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {["All", "Processing", "Shipped", "Delivered", "Cancelled"].map((f) => (
            <button key={f} onClick={() => setOrderFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                orderFilter === f ? "text-white shadow-sm" : "text-gray-500 hover:text-gray-700 bg-gray-100"
              }`}
              style={orderFilter === f ? { backgroundColor: colors.maroon } : undefined}>
              {f}
            </button>
          ))}
        </div>

        {/* Orders Table */}
        <Card className="border shadow-md" style={{ borderColor: `${colors.templeGold}20` }}>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ borderColor: `${colors.templeGold}15` }}>
                    <th className="px-6 py-3">Order ID</th><th className="px-6 py-3">Customer</th><th className="px-6 py-3">Product</th>
                    <th className="px-6 py-3">Amount</th><th className="px-6 py-3">Status</th><th className="px-6 py-3">Date</th><th className="px-6 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((order) => (
                    <tr key={order.id} className="border-b hover:bg-gray-50/60 transition-colors" style={{ borderColor: `${colors.templeGold}10` }}>
                      <td className="px-6 py-3 font-medium" style={{ color: colors.deep }}>{order.id}</td>
                      <td className="px-6 py-3 text-gray-700">{order.customer?.name ?? '—'}</td>
                      <td className="px-6 py-3 text-gray-500 max-w-[220px] truncate">
                        {order.items.map(i => `${i.name} ×${i.quantity}`).join(', ')}
                      </td>
                      <td className="px-6 py-3 font-medium" style={{ color: colors.deep }}>₹{order.total}</td>
                      <td className="px-6 py-3">
                        <select value={order.status} onChange={(e) => updateOrderStatus(order.id, e.target.value)}
                          className="text-xs px-2 py-1 rounded-md border bg-white cursor-pointer"
                          style={{ borderColor: `${colors.templeGold}40`, color: colors.deep }}>
                          {["Processing","Shipped","Delivered","Cancelled"].map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="px-6 py-3 text-gray-400">{order.date}</td>
                      <td className="px-6 py-3">
                        <Button variant="ghost" size="sm" onClick={() => setOrderDetail(order)}
                          className="text-xs gap-1 h-7" style={{ color: colors.saffron }}>
                          <Eye className="w-3 h-3" /> View
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} className="px-6 py-10 text-center text-gray-400 text-xs">No orders yet — place an order from the storefront and refresh.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </>
    );
  };

  const renderCustomers = () => (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: colors.deep }}>Customers</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage your customer base and relationships</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => downloadCSV(
            'customers.csv',
            [['Name','Email','Phone','Orders','Spent','Joined','Role'],
            ...signedUpCustomers.map(c => {
              const stats = customerStats.get(c.email.toLowerCase()) ?? { orders: 0, spent: 0 };
              return [c.name, c.email, c.phone ?? '', stats.orders, stats.spent, new Date(c.createdAt).toLocaleDateString(), c.role];
            })]
          )} className="text-xs gap-1" style={{ borderColor: `${colors.templeGold}30` }}>
            <Download className="w-3.5 h-3.5" /> Export
          </Button>
          <Button size="sm" onClick={refreshCustomers} className="text-xs gap-1 text-white" style={{ backgroundColor: colors.maroon }}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Customer Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(() => {
          const totalSpent = Array.from(customerStats.values()).reduce((s, v) => s + v.spent, 0);
          const buyers = Array.from(customerStats.values()).filter(v => v.orders > 0).length;
          const aov = adminOrders.length > 0 ? Math.round(totalSpent / adminOrders.length) : 0;
          const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
          const newThisMonth = signedUpCustomers.filter(c => new Date(c.createdAt).getTime() >= monthAgo).length;
          return [
            { label: "Total Customers", value: String(signedUpCustomers.length), icon: Users, color: colors.templeGold },
            { label: "Active Buyers", value: String(buyers), icon: Star, color: colors.saffron },
            { label: "New This Month", value: String(newThisMonth), icon: UserPlus, color: "#16a34a" },
            { label: "Avg. Order Value", value: `₹${aov.toLocaleString('en-IN')}`, icon: IndianRupee, color: colors.deep },
          ];
        })().map((s, i) => (
          <Card key={i} className="border shadow-sm card-enter" style={{ borderColor: `${colors.templeGold}20` }}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${s.color}15`, color: s.color }}>
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xl font-bold" style={{ color: colors.deep }}>{s.value}</p>
                <p className="text-xs text-gray-500">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Customers Table */}
      <Card className="border shadow-md" style={{ borderColor: `${colors.templeGold}20` }}>
        <CardHeader className="pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <CardTitle className="text-base" style={{ color: colors.deep }}>Customer Directory</CardTitle>
            <Input placeholder="Search customers..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)}
              className="h-8 text-xs w-48" style={{ borderColor: `${colors.templeGold}30` }} />
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={{ borderColor: `${colors.templeGold}15` }}>
                  <th className="px-6 py-3">Name</th>
                  <th className="px-6 py-3">Email</th>
                  <th className="px-6 py-3">Orders</th>
                  <th className="px-6 py-3">Total Spent</th>
                  <th className="px-6 py-3">Phone</th>
                  <th className="px-6 py-3">Joined</th>
                  <th className="px-6 py-3">Status</th>
                  <th className="px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => {
                  const stats = customerStats.get(customer.email.toLowerCase()) ?? { orders: 0, spent: 0 };
                  const status = stats.spent > 5000 ? 'VIP' : stats.orders > 0 ? 'Active' : 'New';
                  return (
                    <tr key={customer.email} className="border-b hover:bg-gray-50/60 transition-colors" style={{ borderColor: `${colors.templeGold}10` }}>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: colors.maroon }}>
                            {customer.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-medium" style={{ color: colors.deep }}>{customer.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3 text-gray-500">{customer.email}</td>
                      <td className="px-6 py-3 text-gray-700">{stats.orders}</td>
                      <td className="px-6 py-3 font-medium" style={{ color: colors.deep }}>₹{stats.spent.toLocaleString('en-IN')}</td>
                      <td className="px-6 py-3 text-gray-500">{customer.phone || '—'}</td>
                      <td className="px-6 py-3 text-gray-400">{new Date(customer.createdAt).toLocaleDateString()}</td>
                      <td className="px-6 py-3"><CustomerStatusBadge status={status} /></td>
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => window.location.href = `mailto:${customer.email}`} className="h-7 w-7 hover:bg-amber-50">
                            <Mail className="w-3.5 h-3.5" style={{ color: colors.saffron }} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredCustomers.length === 0 && (
                  <tr><td colSpan={8} className="px-6 py-10 text-center text-gray-400 text-xs">No customers yet — invite signups via the storefront.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );

  const renderAnalytics = () => (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: colors.deep }}>Analytics</h2>
          <p className="text-sm text-gray-500 mt-0.5">Detailed insights and performance metrics</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="text-xs gap-1" style={{ borderColor: `${colors.templeGold}30` }}>
            <Download className="w-3.5 h-3.5" /> Export Report
          </Button>
        </div>
      </div>

      {/* Analytics Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Revenue", value: "₹12.4L", change: "+12.5%", trend: "up", icon: DollarSign },
          { label: "Avg. Order Value", value: "₹1,008", change: "+5.2%", trend: "up", icon: IndianRupee },
          { label: "Customer Lifetime Value", value: "₹3,450", change: "+8.1%", trend: "up", icon: Users },
          { label: "Return Rate", value: "2.4%", change: "-0.8%", trend: "up", icon: RefreshCw },
        ].map((s, i) => (
          <Card key={i} className="border shadow-sm card-enter" style={{ borderColor: `${colors.templeGold}20` }}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${colors.templeGold}15`, color: colors.templeGold }}>
                  <s.icon className="w-4 h-4" />
                </div>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.trend === "up" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                  {s.change}
                </span>
              </div>
              <p className="text-xl font-bold" style={{ color: colors.deep }}>{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue Chart */}
      <Card className="border shadow-md card-enter" style={{ borderColor: `${colors.templeGold}20` }}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base" style={{ color: colors.deep }}>Revenue Trend</CardTitle>
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <TrendingUp className="w-3.5 h-3.5" style={{ color: colors.saffron }} /> Monthly Breakdown
            </div>
          </div>
        </CardHeader>
        <CardContent><BarChart /></CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border shadow-md card-enter" style={{ borderColor: `${colors.templeGold}20` }}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base" style={{ color: colors.deep }}>Order Distribution by Category</CardTitle>
          </CardHeader>
          <CardContent><DonutChart /></CardContent>
        </Card>
        <Card className="border shadow-md card-enter" style={{ borderColor: `${colors.templeGold}20` }}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base" style={{ color: colors.deep }}>Customer Growth</CardTitle>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: colors.maroon }} />Returning</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 rounded-full" style={{ backgroundColor: colors.saffron }} />New</span>
              </div>
            </div>
          </CardHeader>
          <CardContent><AreaChart /></CardContent>
        </Card>
      </div>

      {/* Top Performing Metrics */}
      <Card className="border shadow-md card-enter" style={{ borderColor: `${colors.templeGold}20` }}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base" style={{ color: colors.deep }}>Top Performing Products</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {topProducts.map((product, i) => (
            <div key={i} className="flex items-center gap-4">
              <span className="text-sm font-bold w-6 text-center" style={{ color: colors.templeGold }}>#{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 truncate">{product.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(product.revenue / product.maxRevenue) * 100}%`, background: `linear-gradient(90deg, ${colors.saffron}, ${colors.templeGold})` }} />
                  </div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold" style={{ color: colors.deep }}>₹{(product.revenue / 1000).toFixed(1)}k</p>
                <p className="text-xs text-gray-400">{product.sales} sold</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );

  const renderSettings = () => (
    <>
      <div>
        <h2 className="text-2xl font-bold" style={{ color: colors.deep }}>Settings</h2>
        <p className="text-sm text-gray-500 mt-0.5">Configure your store and account preferences</p>
      </div>

      {/* General Settings */}
      <Card className="border shadow-md" style={{ borderColor: `${colors.templeGold}20` }}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2" style={{ color: colors.deep }}>
            <Globe className="w-5 h-5" style={{ color: colors.templeGold }} /> General Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Store Name</label>
              <Input value={general.storeName} onChange={(e) => setGeneral(g => ({ ...g, storeName: e.target.value }))}
                className="h-9 text-sm" style={{ borderColor: `${colors.templeGold}30` }} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Store Email</label>
              <Input value={general.storeEmail} onChange={(e) => setGeneral(g => ({ ...g, storeEmail: e.target.value }))}
                className="h-9 text-sm" style={{ borderColor: `${colors.templeGold}30` }} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Currency</label>
              <Input value={general.currency} onChange={(e) => setGeneral(g => ({ ...g, currency: e.target.value }))}
                className="h-9 text-sm" style={{ borderColor: `${colors.templeGold}30` }} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Timezone</label>
              <Input value={general.timezone} onChange={(e) => setGeneral(g => ({ ...g, timezone: e.target.value }))}
                className="h-9 text-sm" style={{ borderColor: `${colors.templeGold}30` }} />
            </div>
          </div>
          <Button size="sm" onClick={saveGeneral} className="text-xs gap-1 text-white" style={{ backgroundColor: colors.maroon }}>
            <Save className="w-3.5 h-3.5" /> Save Changes
          </Button>
        </CardContent>
      </Card>

      {/* Appearance Settings */}
      <Card className="border shadow-md" style={{ borderColor: `${colors.templeGold}20` }}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2" style={{ color: colors.deep }}>
            <Palette className="w-5 h-5" style={{ color: colors.templeGold }} /> Appearance
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: `${colors.templeGold}15` }}>
            <div>
              <p className="text-sm font-medium">Theme Color</p>
              <p className="text-xs text-gray-500">Primary brand color for your store</p>
            </div>
            <div className="flex items-center gap-2">
              {(["maroon", "templeGold", "saffron"] as const).map(key => (
                <button key={key} onClick={() => pickTheme(key)} aria-label={`Set theme to ${key}`}
                  className={`w-7 h-7 rounded-full border-2 shadow transition-all ${themeColor === key ? "ring-2 ring-offset-2 scale-110" : "border-white"}`}
                  style={{ backgroundColor: colors[key], ...(themeColor === key ? { boxShadow: `0 0 0 2px ${colors[key]}` } : {}) }}
                />
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: `${colors.templeGold}15` }}>
            <div>
              <p className="text-sm font-medium">Dark Mode</p>
              <p className="text-xs text-gray-500">Enable dark mode for admin panel</p>
            </div>
            <button onClick={toggleDark} aria-label="Toggle dark mode"
              className={`relative w-11 h-6 rounded-full transition-colors ${darkMode ? "" : "bg-gray-300"}`}
              style={darkMode ? { backgroundColor: colors.templeGold } : undefined}>
              <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${darkMode ? "translate-x-[22px] left-0" : "left-1"}`} />
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card className="border shadow-md" style={{ borderColor: `${colors.templeGold}20` }}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2" style={{ color: colors.deep }}>
            <BellRing className="w-5 h-5" style={{ color: colors.templeGold }} /> Notifications
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {notifs.map((setting, i) => (
            <div key={i} className="flex items-center justify-between p-3 rounded-lg border" style={{ borderColor: `${colors.templeGold}15` }}>
              <div>
                <p className="text-sm font-medium">{setting.label}</p>
                <p className="text-xs text-gray-500">{setting.desc}</p>
              </div>
              <button onClick={() => toggleNotif(i)} aria-label={`Toggle ${setting.label}`}
                className={`relative w-11 h-6 rounded-full transition-colors ${setting.enabled ? "" : "bg-gray-300"}`}
                style={setting.enabled ? { backgroundColor: colors.templeGold } : undefined}>
                <span className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${setting.enabled ? "translate-x-[22px] left-0" : "left-1"}`} />
              </button>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="border shadow-md" style={{ borderColor: `${colors.templeGold}20` }}>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2" style={{ color: colors.deep }}>
            <Shield className="w-5 h-5" style={{ color: colors.templeGold }} /> Security
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Current Password</label>
              <Input type="password" placeholder="Enter current password" value={pwd.current}
                onChange={(e) => setPwd(p => ({ ...p, current: e.target.value }))}
                className="h-9 text-sm" style={{ borderColor: `${colors.templeGold}30` }} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">New Password</label>
              <Input type="password" placeholder="Enter new password" value={pwd.next}
                onChange={(e) => setPwd(p => ({ ...p, next: e.target.value }))}
                className="h-9 text-sm" style={{ borderColor: `${colors.templeGold}30` }} />
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={updatePassword} className="text-xs gap-1" style={{ borderColor: `${colors.templeGold}30`, color: colors.maroon }}>
            <Lock className="w-3.5 h-3.5" /> Update Password
          </Button>
        </CardContent>
      </Card>
    </>
  );

  // ── SECTION ROUTER ──────────────────────────────────
  const renderContent = () => {
    switch (activeNav) {
      case "dashboard": return renderDashboard();
      case "products": return renderProducts();
      case "orders": return renderOrders();
      case "customers": return renderCustomers();
      case "analytics": return renderAnalytics();
      case "settings": return renderSettings();
      default: return renderDashboard();
    }
  };

  // ── PAGE TITLES ─────────────────────────────────────
  const pageTitles: Record<string, { title: string; subtitle: string }> = {
    dashboard: { title: "Dashboard", subtitle: "Welcome back, Shri Admin. Here's your overview." },
    products: { title: "Products", subtitle: "Manage your product inventory and catalog" },
    orders: { title: "Orders", subtitle: "Track and manage customer orders" },
    customers: { title: "Customers", subtitle: "Manage your customer base and relationships" },
    analytics: { title: "Analytics", subtitle: "Detailed insights and performance metrics" },
    settings: { title: "Settings", subtitle: "Configure your store and account preferences" },
  };

  // Gate the admin panel — show a loader until auth is verified.
  if (!authChecked || !session || session.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-temple-cream">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full border-4 border-temple-saffron border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-sm text-temple-deep/60">Checking access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen" style={{ backgroundColor: colors.warmCream }}>
      {/* ── CSS keyframe animations ──────────────────── */}
      <style>{`
        @keyframes slideInLeft {
          from { transform: translateX(-100%); }
          to { transform: translateX(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulseGold {
          0%, 100% { box-shadow: 0 0 0 0 rgba(212,175,55,0.3); }
          50% { box-shadow: 0 0 18px 6px rgba(212,175,55,0.15); }
        }
        @keyframes goldBorderFlow {
          0% { background-position: 0% 50%; }
          100% { background-position: 200% 50%; }
        }
        @keyframes diyaFlicker {
          0%, 100% { transform: scale(1); opacity: 1; }
          25% { transform: scale(1.08); opacity: 0.92; }
          50% { transform: scale(0.95); opacity: 1; }
          75% { transform: scale(1.04); opacity: 0.96; }
        }
        .sidebar-enter { animation: slideInLeft 0.3s ease-out; }
        .card-enter { animation: fadeIn 0.5s ease-out both; }
        .card-enter-1 { animation-delay: 0.05s; }
        .card-enter-2 { animation-delay: 0.10s; }
        .card-enter-3 { animation-delay: 0.15s; }
        .card-enter-4 { animation-delay: 0.20s; }
        .gold-glow { animation: pulseGold 3s ease-in-out infinite; }
        .diya-animate { animation: diyaFlicker 2s ease-in-out infinite; }
        .temple-header-bg {
          background: linear-gradient(180deg, #1A0A2E 0%, ${colors.maroon} 60%, #3D1C00 100%);
        }
        .stat-gradient-revenue { background: linear-gradient(135deg, ${colors.saffron}12, ${colors.templeGold}08); }
        .stat-gradient-orders { background: linear-gradient(135deg, ${colors.maroon}10, ${colors.saffron}06); }
        .stat-gradient-customers { background: linear-gradient(135deg, ${colors.templeGold}10, ${colors.maroon}06); }
        .stat-gradient-conversion { background: linear-gradient(135deg, ${colors.deep}08, ${colors.maroon}06); }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${colors.templeGold}60; border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: ${colors.templeGold}; }
      `}</style>

      {/* ── Sidebar ──────────────────────────────────── */}
      <aside className={`${sidebarOpen ? "w-64" : "w-0 overflow-hidden"} shrink-0 temple-header-bg text-white flex flex-col transition-all duration-300 relative z-30 sidebar-enter`}>
        {/* Temple ornamental top */}
        <div className="px-5 pt-5 pb-3" style={{ borderBottom: `1px solid ${colors.templeGold}30` }}>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-lg flex items-center justify-center gold-glow" style={{ backgroundColor: colors.templeGold, color: colors.deep }}>
              <Landmark className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-lg leading-tight" style={{ color: colors.templeGold }}>Shri Fragrance</h1>
              <p className="text-[10px] opacity-50 flex items-center gap-1">
                <span className="diya-animate inline-block">🔥</span> Admin Dashboard
              </p>
            </div>
          </div>
          {/* Decorative gold line */}
          <div className="mt-3 h-px w-full" style={{ background: `linear-gradient(90deg, transparent, ${colors.templeGold}60, #FFD70040, ${colors.templeGold}60, transparent)` }} />
        </div>

        {/* Kolam dots background */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" style={{ backgroundImage: 'radial-gradient(circle, rgba(212,175,55,0.05) 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
          {navItems.map((item, idx) => {
            const isActive = activeNav === item.key;
            return (
              <button key={item.key} onClick={() => setActiveNav(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 card-enter ${isActive ? "text-white shadow-lg" : "text-white/60 hover:text-white hover:bg-white/8"}`}
                style={{
                  ...(isActive ? { background: `linear-gradient(135deg, ${colors.saffron}, ${colors.maroon})`, animationDelay: `${idx * 0.05}s` } : {}),
                  animationDelay: `${idx * 0.05}s`
                }}>
                <item.icon className="w-5 h-5 shrink-0" />
                <span>{item.label}</span>
                {isActive && <div className="ml-auto w-2 h-2 rounded-full diya-animate" style={{ backgroundColor: '#FFD700' }} />}
              </button>
            );
          })}
        </nav>

        {/* Back to Home link */}
        <div className="px-3 py-2" style={{ borderTop: `1px solid ${colors.templeGold}25` }}>
          {bottomNavItems.map((item) => (
            <a key={item.href} href={item.href}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 text-white/60 hover:text-white hover:bg-white/8">
              <item.icon className="w-5 h-5 shrink-0" />
              <span>{item.label}</span>
              <ArrowLeft className="w-3.5 h-3.5 ml-auto opacity-50" />
            </a>
          ))}
        </div>

        {/* Sidebar footer */}
        <div className="px-4 py-4" style={{ borderTop: `1px solid ${colors.templeGold}25` }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold gold-glow" style={{ backgroundColor: colors.templeGold, color: colors.deep }}>SA</div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">Shri Admin</p>
              <p className="text-[10px] opacity-40 truncate">admin@shrifragrance.com</p>
            </div>
          </div>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* ── Top Bar with temple gold border ────────── */}
        <header className="sticky top-0 z-20 flex items-center gap-3 px-4 md:px-6 py-3 border-b"
          style={{ backgroundColor: "#fff", borderColor: `${colors.templeGold}25` }}>
          {/* Temple gold accent line */}
          <div className="absolute top-0 left-0 right-0 h-[2px]" style={{ background: `linear-gradient(90deg, transparent, ${colors.templeGold}, ${colors.saffron}, ${colors.templeGold}, transparent)` }} />

          <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(!sidebarOpen)} className="shrink-0 hover:bg-gray-100">
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>

          {/* Back to Home button */}
          <a href="/"
            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 hover:shadow-md"
            style={{ backgroundColor: `${colors.maroon}10`, color: colors.maroon, border: `1px solid ${colors.maroon}20` }}>
            <ArrowLeft className="w-3.5 h-3.5" />
            <Home className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back to Home</span>
          </a>

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input placeholder="Search products, orders, customers..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm" style={{ borderColor: `${colors.templeGold}30` }} />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="relative hover:bg-gray-100">
                  <Bell className="w-5 h-5" />
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center text-white diya-animate"
                    style={{ backgroundColor: colors.saffron }}>3</span>
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogTitle className="font-semibold text-base" style={{ color: colors.deep }}>Notifications</DialogTitle>
                <DialogDescription className="sr-only">Recent admin notifications and alerts.</DialogDescription>
                <div className="space-y-3">
                  <h3 className="sr-only">Recent activity</h3>
                  {[
                    { title: "New order #ORD-7893 received", time: "2 min ago", type: "order" },
                    { title: "Low stock alert: Sandalwood Oil", time: "15 min ago", type: "alert" },
                    { title: "Customer review: 5 stars on Chandan Incense", time: "1 hr ago", type: "review" },
                  ].map((n, i) => (
                    <div key={i} className="flex gap-3 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: n.type === "alert" ? colors.saffron : colors.templeGold }} />
                      <div><p className="text-sm">{n.title}</p><p className="text-xs text-gray-400">{n.time}</p></div>
                    </div>
                  ))}
                </div>
              </DialogContent>
            </Dialog>

            <div className="relative">
              <button onClick={() => setProfileOpen(!profileOpen)} className="flex items-center gap-2 rounded-full pl-1 pr-3 py-1 hover:bg-gray-100 transition-colors">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold gold-glow" style={{ backgroundColor: colors.maroon, color: colors.warmCream }}>
                  {(session?.name ?? 'SA').slice(0, 2).toUpperCase()}
                </div>
                <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
              </button>
              {profileOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setProfileOpen(false)} />
                  <div className="absolute right-0 top-11 w-56 bg-white rounded-lg shadow-xl border py-2 z-50" style={{ borderColor: `${colors.templeGold}25` }}>
                    <div className="px-4 pb-2 border-b" style={{ borderColor: `${colors.templeGold}15` }}>
                      <p className="text-sm font-semibold" style={{ color: colors.deep }}>{session?.name}</p>
                      <p className="text-[11px] text-gray-500 truncate">{session?.email}</p>
                    </div>
                    {["Settings", "Logout"].map((item) => (
                      <button key={item} className="w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition-colors"
                        style={item === "Logout" ? { color: colors.maroon, fontWeight: 600 } : undefined}
                        onClick={() => {
                          setProfileOpen(false);
                          if (item === "Settings") setActiveNav("settings");
                          else if (item === "Logout") handleLogout();
                        }}>{item}</button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* ── Page Content ──────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6" style={{ backgroundImage: 'radial-gradient(circle, rgba(212,175,55,0.02) 1px, transparent 1px)', backgroundSize: '30px 30px' }}>
          {renderContent()}
        </main>
      </div>

      {/* ── Mobile sidebar overlay ──────────────────── */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/30 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* ── Product Add/Edit Dialog ─────────────────── */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogTitle className="text-base font-bold" style={{ color: colors.deep }}>
            {editingProduct ? 'Edit Product' : 'Add Product'}
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            {editingProduct ? 'Update product details and save.' : 'Add a new product to your catalog.'}
          </DialogDescription>

          <div className="space-y-3 mt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Name *</label>
                <Input value={productDraft.name} onChange={(e) => setProductDraft(d => ({ ...d, name: e.target.value }))}
                  className="h-9 text-sm" style={{ borderColor: `${colors.templeGold}30` }} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Category</label>
                <Input value={productDraft.category} onChange={(e) => setProductDraft(d => ({ ...d, category: e.target.value }))}
                  placeholder="Floral, Herbal, Premium..." className="h-9 text-sm" style={{ borderColor: `${colors.templeGold}30` }} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Price</label>
                <Input value={productDraft.price} onChange={(e) => setProductDraft(d => ({ ...d, price: e.target.value }))}
                  placeholder="₹299" className="h-9 text-sm" style={{ borderColor: `${colors.templeGold}30` }} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 mb-1 block">Stock</label>
                <Input type="number" value={productDraft.stock} onChange={(e) => setProductDraft(d => ({ ...d, stock: e.target.value }))}
                  placeholder="0" className="h-9 text-sm" style={{ borderColor: `${colors.templeGold}30` }} />
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Product Image</label>
              <div className="flex items-center gap-3">
                {productDraft.image ? (
                  <img src={productDraft.image} alt="" className="w-16 h-16 rounded-lg object-cover border" style={{ borderColor: `${colors.templeGold}30` }} />
                ) : (
                  <div className="w-16 h-16 rounded-lg flex items-center justify-center border" style={{ borderColor: `${colors.templeGold}30`, backgroundColor: `${colors.templeGold}10` }}>
                    <Package className="w-6 h-6" style={{ color: colors.saffron }} />
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <input id="admin-product-image" type="file" accept="image/*" className="hidden"
                    onChange={(e) => handleImageFile(e.target.files?.[0])} />
                  <Button variant="outline" size="sm" type="button"
                    onClick={() => document.getElementById('admin-product-image')?.click()}
                    className="text-xs gap-1 h-8" style={{ borderColor: `${colors.templeGold}30` }}>
                    <Upload className="w-3 h-3" /> {productDraft.image ? 'Change' : 'Upload'}
                  </Button>
                  {productDraft.image && (
                    <Button variant="ghost" size="sm" type="button"
                      onClick={() => setProductDraft(d => ({ ...d, image: '' }))}
                      className="text-xs gap-1 h-7 text-red-500 hover:bg-red-50">
                      <Trash2 className="w-3 h-3" /> Remove
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-gray-400 mt-1">Auto-resized to 400px JPEG, saved to your browser.</p>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-5">
            <Button variant="outline" onClick={() => setProductDialogOpen(false)} className="text-xs h-9" style={{ borderColor: `${colors.templeGold}30` }}>
              Cancel
            </Button>
            <Button onClick={handleSaveProduct} className="text-xs h-9 text-white gap-1" style={{ backgroundColor: colors.maroon }}>
              <Save className="w-3.5 h-3.5" /> {editingProduct ? 'Save Changes' : 'Add Product'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Order Detail Dialog ─────────────────── */}
      <Dialog open={!!orderDetail} onOpenChange={(open) => !open && setOrderDetail(null)}>
        <DialogContent className="max-w-2xl">
          {orderDetail && (
            <>
              <DialogTitle className="text-base font-bold" style={{ color: colors.deep }}>
                Order {orderDetail.id}
              </DialogTitle>
              <DialogDescription className="text-xs text-gray-500">
                Placed on {orderDetail.date} · Status: {orderDetail.status}
              </DialogDescription>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <div className="p-3 rounded-lg border" style={{ borderColor: `${colors.templeGold}25` }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: colors.saffron }}>Customer</p>
                  <p className="text-sm font-semibold" style={{ color: colors.deep }}>{orderDetail.customer?.name ?? '—'}</p>
                  <p className="text-xs text-gray-500">{orderDetail.customer?.email}</p>
                  <p className="text-xs text-gray-500">{orderDetail.customer?.phone}</p>
                </div>
                <div className="p-3 rounded-lg border" style={{ borderColor: `${colors.templeGold}25` }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider mb-1.5" style={{ color: colors.saffron }}>Shipping</p>
                  {orderDetail.shipment ? (
                    <>
                      <p className="text-sm" style={{ color: colors.deep }}>{orderDetail.shipment.address}</p>
                      <p className="text-xs text-gray-500">{orderDetail.shipment.city}, {orderDetail.shipment.state} — {orderDetail.shipment.pincode}</p>
                      <p className="text-[10px] font-semibold uppercase tracking-wider mt-1" style={{ color: colors.saffron }}>
                        {orderDetail.shipment.method === 'express' ? 'Express • 1–2 days' : 'Standard • 3–5 days'}
                      </p>
                    </>
                  ) : <p className="text-xs text-gray-400">No shipping info</p>}
                </div>
              </div>

              <div className="mt-4 rounded-lg border" style={{ borderColor: `${colors.templeGold}25` }}>
                <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider border-b" style={{ color: colors.saffron, borderColor: `${colors.templeGold}25` }}>Items</p>
                <ul className="divide-y" style={{ borderColor: `${colors.templeGold}15` }}>
                  {orderDetail.items.map((it, i) => (
                    <li key={i} className="flex justify-between items-center px-3 py-2 text-sm">
                      <span style={{ color: colors.deep }}>{it.name} × {it.quantity}</span>
                      <span className="font-semibold" style={{ color: colors.deep }}>₹{it.price * it.quantity}</span>
                    </li>
                  ))}
                </ul>
                <div className="px-3 py-2 flex justify-between text-sm font-bold border-t" style={{ color: colors.deep, borderColor: `${colors.templeGold}25` }}>
                  <span>Total</span><span>₹{orderDetail.total}</span>
                </div>
              </div>

              <div className="mt-4 flex justify-between items-center gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">Status:</span>
                  <select value={orderDetail.status} onChange={(e) => {
                    updateOrderStatus(orderDetail.id, e.target.value);
                    setOrderDetail({ ...orderDetail, status: e.target.value });
                  }} className="text-xs px-2 py-1 rounded-md border bg-white cursor-pointer"
                    style={{ borderColor: `${colors.templeGold}40`, color: colors.deep }}>
                    {["Processing","Shipped","Delivered","Cancelled"].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <Button onClick={() => setOrderDetail(null)} variant="outline" className="text-xs h-8" style={{ borderColor: `${colors.templeGold}30` }}>
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
