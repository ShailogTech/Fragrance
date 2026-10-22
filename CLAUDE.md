# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Next.js dev server (http://localhost:3000)
npm run build        # Production build
npm run start        # Run production build
npm run lint         # next lint (ESLint with eslint-config-next)
npm run seed         # tsx prisma/seed.ts — seed dev SQLite DB

npx prisma migrate dev    # Apply / create migrations against dev.db
npx prisma generate       # Regenerate @prisma/client after schema change
npx prisma studio         # Inspect dev.db in browser
```

Vitest, jsdom, and @testing-library are installed as devDependencies, but no test files, `vitest.config.*`, or `test`/`test:*` script exist yet. Adding tests requires creating both the config and a script.

Env vars (no `.env*` is committed):
- `DATABASE_URL` — required by Prisma's `datasource`; create `.env` with `DATABASE_URL="file:./prisma/dev.db"` before running migrations or the app.
- `JWT_SECRET` — `src/lib/auth.ts` falls back to a hard-coded dev secret if unset (dev only).
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — required for the Google OAuth login flow (`/api/auth/google/*`); the flow is non-functional without them.

## Architecture

Next.js 14 App Router e-commerce app (fragrance store) with a single Prisma/SQLite database serving both customer storefront and admin panel from the same Next process.

**Stack:** Next.js 14.2 (App Router, RSC by default) · TypeScript strict · Prisma 6 + SQLite · Tailwind (`darkMode: "class"`, custom palette in `tailwind.config.ts`) · Zustand (client state) · Zod · react-hook-form · framer-motion · bcryptjs + jsonwebtoken (auth). Path alias `@/*` → `src/*`. Note: `@tanstack/react-query` is a dependency but **not wired** — there is no `QueryClientProvider`; data fetching is plain `fetch` in RSC/route handlers, not react-query.

**Auth (`src/lib/auth.ts`):** Custom JWT in an `httpOnly` cookie `shri_auth` (7-day expiry). `getCurrentUser()` is the server-side identity primitive — call it in Server Components, route handlers, and `layout.tsx` files. Roles are a string column on `User` (`"Customer"` default, `"Admin"` for admin access). The admin layout (`src/app/admin/layout.tsx`) guards the entire `/admin` subtree by checking `user.role === "Admin"` and redirecting/denying otherwise; individual admin pages assume the gate already ran. API routes under `src/app/api/admin/*` must re-check the role themselves — layouts do not protect route handlers. Two auth entry points issue the JWT: email/password (`/api/auth/{login,register}`) and Google OAuth (`/api/auth/google/start` → Google → `/api/auth/google/callback`, which upserts the user and sets the same `shri_auth` cookie; uses a `g_oauth_state` cookie for CSRF). `src/components/AuthSync.tsx` (mounted in the root layout) calls `/api/auth/me` on mount to mirror the server session into the `useAuth` Zustand store — it does not establish auth, only reflects it client-side.

**Prisma client (`src/lib/db.ts`):** Singleton pattern via `globalThis` to survive Next.js dev hot-reload. Always import `prisma` from `@/lib/db`; do not instantiate `PrismaClient` directly elsewhere.

**Client state (`src/lib/store.ts`):** Three Zustand stores persisted to localStorage:
- `useCart` (key `shri-cart`) — cart items + `count()`/`subtotal()` selectors
- `useWishlist` (key `shri-wishlist`)
- `useAuth` (key `shri-auth`) — **mirror only**, kept in sync with the server session by `src/components/AuthSync.tsx`. The cookie + `getCurrentUser()` is the source of truth; never trust `useAuth` for authorization decisions.

All three are `"use client"`. Server Components must not import from `store.ts`.

**Data model (`prisma/schema.prisma`):** Core models — `User` ↔ `Address`/`Order`, `Category` (self-referential `parentId` hierarchy via `CatHierarchy` relation), `Product` (single `categoryId`, `images` and `features` stored as **stringified JSON** because SQLite has no array type — parse on read, stringify on write), `Order` → `OrderItem` (with `shippingAddress` also stored as a JSON string), `Coupon`. Prices are `Float`.

**Routing layout:**
- `src/app/` — public routes: `products`, `collections`, `cart`, `checkout`, `wishlist`, `search`, `my-orders`, `order-success`, `profile`, `login`, `register`, `(legal)`, `_home`
- `src/app/admin/` — admin UI, gated by `admin/layout.tsx` (which sets `export const dynamic = "force-dynamic"` — admin pages are never statically cached); has its own `_components/` (sidebar etc.). Pages include products, orders, users, customers, coupons, categories, inventory, analytics, reports, best-sellers, resellers, coming-soon.
- `src/app/api/` — route handlers: `auth/{login,logout,me,register}`, `auth/google/{start,callback}`, `orders`, `admin/{products,orders,users,coupons,export,upload}`, `uploads/[name]`

Customer order placement hits `/api/orders`; admin CRUD lives under `/api/admin/*`. Forms validate with Zod + react-hook-form before POSTing.

**Image upload:** Admin uploads POST FormData (`file`) to `/api/admin/upload` (Admin-gated; validates jpeg/png/webp/gif/avif, max 5 MB). Files are written to `public/uploads/` with a `timestamp-randomhex` name and served back via `/api/uploads/{name}`. Stored in `Product.images` as the returned URL string(s).

## Conventions

- Server Components are the default — only add `"use client"` when you need state, effects, or browser APIs.
- `getCurrentUser()` (not the Zustand `useAuth`) for any server-side auth/role check.
- When changing `schema.prisma`, run `npx prisma migrate dev` and `npx prisma generate`; commit the new migration folder under `prisma/migrations/`.
- JSON-string columns (`Product.images`, `Product.features`, `Order.shippingAddress`) — remember to `JSON.parse`/`JSON.stringify` at the boundary.
- Admin route handlers under `/api/admin/*` must independently verify `user.role === "Admin"`; the layout guard does not cover them.
