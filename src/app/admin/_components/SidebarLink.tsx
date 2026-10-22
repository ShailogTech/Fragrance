"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid,
  Package,
  ShoppingCart,
  Users,
  UserCog,
  Tag,
  BarChart3,
} from "lucide-react";

const ICONS = {
  dashboard: LayoutGrid,
  products: Package,
  orders: ShoppingCart,
  users: Users,
  resellers: UserCog,
  coupons: Tag,
  analytics: BarChart3,
} as const;

export function AdminSidebarLink({
  href,
  label,
  iconKey,
}: {
  href: string;
  label: string;
  iconKey: keyof typeof ICONS;
}) {
  const pathname = usePathname();
  const Icon = ICONS[iconKey];
  const active =
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
        active
          ? "bg-brand-soft text-brand-hover"
          : "text-ink-muted hover:bg-brand-soft/40 hover:text-ink"
      }`}
    >
      <Icon size={18} />
      {label}
    </Link>
  );
}
