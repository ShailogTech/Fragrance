"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { RefreshCcw, Download, Trash2, Plus } from "lucide-react";

export function RefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      onClick={() => startTransition(() => router.refresh())}
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-ink hover:border-brand disabled:opacity-50"
    >
      <RefreshCcw size={14} className={pending ? "animate-spin" : ""} /> Refresh
    </button>
  );
}

export function ExportButton({ type, label }: { type: "products" | "orders" | "users"; label?: string }) {
  return (
    <a
      href={`/api/admin/export?type=${type}`}
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-white px-4 py-2 text-sm font-semibold text-ink hover:border-brand"
    >
      <Download size={14} /> {label ?? "Export CSV"}
    </a>
  );
}

export function DeleteRowButton({
  endpoint,
  label = "Delete this item?",
}: {
  endpoint: string;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function handle() {
    if (!confirm(label)) return;
    setBusy(true);
    try {
      const r = await fetch(endpoint, { method: "DELETE" });
      const j = await r.json();
      if (!j.success) alert(j.error ?? "Failed");
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      onClick={handle}
      disabled={busy}
      aria-label="Delete"
      className="rounded-md p-1.5 text-danger hover:bg-danger/10 disabled:opacity-50"
    >
      <Trash2 size={14} />
    </button>
  );
}

export function AddProductButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function handle() {
    const name = prompt("Product name?");
    if (!name) return;
    const priceStr = prompt("Price (₹)?");
    if (!priceStr) return;
    const price = Number(priceStr);
    if (Number.isNaN(price)) return alert("Invalid price");
    const mrpStr = prompt("MRP (₹)?", priceStr);
    const mrp = Number(mrpStr);
    if (Number.isNaN(mrp)) return alert("Invalid MRP");
    const stockStr = prompt("Stock?", "100");
    const stock = Number(stockStr);
    const image = prompt("Image URL? (optional)") ?? "";

    setBusy(true);
    try {
      const r = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, price, mrp, stock, image }),
      });
      const j = await r.json();
      if (!j.success) alert(j.error ?? "Failed");
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      onClick={handle}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
    >
      <Plus size={14} /> Add Product
    </button>
  );
}

export function AddCouponButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function handle() {
    const code = prompt("Coupon code (e.g. SAVE20)?");
    if (!code) return;
    const description = prompt("Description?", "") ?? "";
    const type = prompt("Type: Percentage or Fixed?", "Percentage") ?? "Percentage";
    const valStr = prompt(type === "Percentage" ? "Value (e.g. 20 for 20%)?" : "Flat ₹ off?");
    if (!valStr) return;
    const value = Number(valStr);
    if (Number.isNaN(value)) return alert("Invalid value");
    const minOrderStr = prompt("Min order ₹?", "0") ?? "0";
    const minOrder = Number(minOrderStr) || 0;

    setBusy(true);
    try {
      const r = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, description, type, value, minOrder }),
      });
      const j = await r.json();
      if (!j.success) alert(j.error ?? "Failed");
      else router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      onClick={handle}
      disabled={busy}
      className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-hover disabled:opacity-50"
    >
      <Plus size={14} /> Add Coupon
    </button>
  );
}

export function UserRoleSelect({ id, role }: { id: string; role: string }) {
  const router = useRouter();
  const [val, setVal] = useState(role);
  const [busy, setBusy] = useState(false);
  async function change(v: string) {
    setVal(v);
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: v }),
      });
      const j = await r.json();
      if (!j.success) {
        alert(j.error ?? "Failed");
        setVal(role);
      } else router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <select
      value={val}
      disabled={busy}
      onChange={(e) => change(e.target.value)}
      className="rounded-md border border-border bg-white px-2 py-1 text-xs disabled:opacity-50"
    >
      <option value="Customer">Customer</option>
      <option value="Admin">Admin</option>
    </select>
  );
}

export function OrderStatusSelect({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [val, setVal] = useState(status);
  const [busy, setBusy] = useState(false);
  async function change(v: string) {
    setVal(v);
    setBusy(true);
    try {
      const r = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: v }),
      });
      const j = await r.json();
      if (!j.success) {
        alert(j.error ?? "Failed");
        setVal(status);
      } else router.refresh();
    } finally {
      setBusy(false);
    }
  }
  return (
    <select
      value={val}
      disabled={busy}
      onChange={(e) => change(e.target.value)}
      className="rounded-md border border-border bg-white px-2 py-1 text-xs disabled:opacity-50"
    >
      <option value="pending">pending</option>
      <option value="paid">paid</option>
      <option value="shipped">shipped</option>
      <option value="delivered">delivered</option>
      <option value="cancelled">cancelled</option>
      <option value="failed">failed</option>
    </select>
  );
}
