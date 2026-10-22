# Shri Fragrance — Design Spec

**Date:** 2026-05-06
**Build mode:** Local demo (not deployed)
**Architectural reference:** Julex (https://julex.store) — patterns reused, source not copied

---

## 1. Product summary

Shri Fragrance is a hybrid B2C + B2B e-commerce demo for a **South Indian devotional fragrance** brand. It sells pooja-room essentials: agarbatti, sambrani/dhoop, camphor (karpooram), brass vilakku, pooja oils, wicks (thiri), vibhuti/sandal/kumkum, and gift sets.

**Roles**
- `Customer` — retail (B2C) pricing, default on signup
- `Reseller` — wholesale (B2B) pricing, requires admin verification before B2B prices unlock
- `Admin` — manages catalog, orders, users, reseller verification

**Why a demo build:** the goal is a showcase-quality local app. No live deployment, no real payment/SMS/email providers, no production hosting. Architecture is built so a later prod cutover is straightforward (swap demo flags, add real keys).

---

## 2. Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14.2.x (App Router) |
| Language | TypeScript, **strict mode on** |
| UI | shadcn/ui + Tailwind 3.4 + Framer Motion |
| Database | PostgreSQL (Docker Compose) + Prisma ORM |
| Auth | JWT (HttpOnly cookie) + bcryptjs (12 rounds) |
| State | Zustand (persisted to localStorage) |
| Data fetching | TanStack Query |
| Forms | React Hook Form + Zod |
| Payments | Razorpay (test keys + `DEMO_PAYMENTS=true` bypass for HMAC verify) |
| OTP | Email + SMS, both via **console logger** in demo mode |
| Image storage | Local FS (`/public/uploads/<uuid>.<ext>`) |
| Tests | Vitest (unit only) |

**Explicit cuts vs the Julex reference:** WhatsApp OTP, Firebase notifications, next-intl/multi-language, Vercel Analytics + custom `PageView`, custom `/api/contact` and `/api/search` endpoints, in-app browser block, two-domain split, COD.

---

## 3. Domain model (Prisma)

**9 models** (Julex had 14; cut: `Review`, `Referral`, `Coupon`, `CouponUsage`, `PageView`).

```
User             id, email(unique), phone, passwordHash, name, role, avatar,
                 emailVerified, otpCode, otpExpiresAt, createdAt, updatedAt
                 -- role enum: Customer | Reseller | Admin

Reseller         id, userId(unique→User), businessName, gstin, address(Json),
                 isVerified(bool, default false), verifiedAt, verifiedBy(userId),
                 createdAt
                 -- created when a customer applies; admin flips isVerified.
                 -- Reseller.address is the business address (Json snapshot,
                 --   single row); Address table below is the user's shipping
                 --   address book (multiple rows per user). Distinct purposes.

Address          id, userId, label, line1, line2, city, state, pincode, phone,
                 isDefault

Category         id, slug(unique), name, image, parentId(nullable, self-ref),
                 sortOrder, isActive
                 -- top-level rows have parentId=null; sub-cats reference parent.
                 -- v1 supports 2 levels max; admin form prevents deeper nesting.

Product          id, slug(unique), categoryId, name, description, images(Json[]),
                 features(Json[]), priceB2c, priceB2b, mrp, stock, sku(unique),
                 isActive, createdAt, updatedAt

Order            id, userId, orderType("B2C"|"B2B"), status, subtotal,
                 shippingFee, total, razorpayOrderId, razorpayPaymentId,
                 razorpaySignature, shippingAddress(Json snapshot),
                 billingAddress(Json snapshot), createdAt
                 -- userId has no cascade-delete; preserves order history

OrderItem        id, orderId, productId, productName(snapshot), unitPrice,
                 quantity, lineTotal

CartItem         id, userId, productId, quantity   -- unique(userId, productId)

WishlistItem     id, userId, productId             -- unique(userId, productId)
```

**Pricing rule (server-authoritative):** on `POST /api/orders`, the server reads `user.role` and `reseller.isVerified`, picks `priceB2c` or `priceB2b` per line, and ignores any prices in the request body. `orderType` is stamped from the same source. The client cart switches display via `useCartStore.setIsB2B(true)` but never sets the order price.

**Address snapshots:** `Order.shippingAddress` and `billingAddress` are `Json` snapshots so historical orders survive address edits/deletes.

---

## 4. Routes & API surface

### Pages (App Router)

```
Public:        /, /products, /products/[slug],
               /collections/[categorySlug],
               /about, /contact, /privacy, /terms,
               /shipping-policy, /refund-policy
Auth:          /login, /register, /forgot-password
Customer:      /profile, /my-orders, /my-orders/[id], /cart, /checkout,
               /wishlist, /order-success/[id]
Reseller:      /reseller/apply, /reseller/dashboard, /reseller/orders
               (gated: role=Reseller AND reseller.isVerified=true)
Admin:         /admin, /admin/products, /admin/products/new,
               /admin/products/[id], /admin/categories,
               /admin/orders, /admin/orders/[id],
               /admin/users, /admin/resellers
               (gated: role=Admin)
```

### API routes

```
/api/auth/         login, register, logout, me, send-otp, verify-otp,
                   forgot-password, reset-password
/api/products/     GET (list+filter+search), GET /[id]
/api/categories/   GET (tree), GET /[slug]
/api/cart/         GET, POST, PATCH /[id], DELETE /[id]
/api/wishlist/     GET, POST, DELETE /[id]
/api/orders/       GET (mine), POST, GET /[id], POST /[id]/cancel
/api/payments/     create-order, verify
/api/user/         addresses (CRUD), change-password, avatar
/api/reseller/     apply, status
/api/admin/        products (CRUD), categories (CRUD),
                   orders (list+update), users (list),
                   resellers/[id]/verify, stats
/api/uploads/      POST → local FS in demo, Blob-ready
/api/health/       liveness check
```

**Response envelope everywhere:** `{ success: boolean, data?, error? }`.

---

## 5. Auth, roles, security

**Auth flow**
1. `/api/auth/register` → bcrypt hash (12 rounds) → `User` row with `role=Customer`. Send email OTP via the console logger; mark `emailVerified` only after successful `verify-otp`.
2. `/api/auth/login` → verify password → issue 7-day JWT → set HttpOnly + SameSite=Lax cookie. The `Secure` flag is set conditionally (`process.env.NODE_ENV === 'production'`) so http://localhost dev still works.
3. Server routes call `getCurrentUser()` from `lib/auth.ts` (reads cookie, verifies JWT, fetches `User` and joined `Reseller` row if applicable).
4. Client mirrors the user in `useAuthStore` for UI gating only — server never trusts client claims.

**Role transitions**
- `Customer` → `Reseller`: customer submits `/reseller/apply`; creates `Reseller` row with `isVerified=false`. Until verified, prices remain B2C and the dashboard shows "Pending verification."
- Admin verifies via `/admin/resellers/[id]/verify`; sets `Reseller.isVerified=true`, `verifiedAt`, `verifiedBy`, and updates `User.role` to `Reseller`. From the next request, B2B prices apply.
- `Admin`: seeded only. No self-signup path.

**Rate limits** (in-memory, per-IP unless noted)
- Auth: 5 / 15 min
- Payments: 10 / hr per user
- General: 100 / min

**Security headers** (middleware): `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, CSP allowlisting Razorpay + Google Fonts + self.

**Single-domain** deployment → no CORS config needed beyond same-origin defaults.

---

## 6. Design system

### Colors

```
Background      #FAF6EE   sandalwood cream — page background
Surface         #FFFFFF   cards, modals
Ink             #1B1410   primary text (near-black brown)
Ink Muted       #6B5E54   secondary text, captions
Brass           #B8862F   primary accent — CTAs, links, prices
Brass Hover     #97701F   button hover
Brass Soft      #F2E6CC   chip backgrounds, subtle hovers
Maroon          #6E1A1A   single contrast accent — sale tags, festival banners (sparing)
Border          #EDE3D1   sandal-tinted divider
Success         #2F7D4F
Danger          #B23A3A
```

Distinct from Julex (which used neon yellow + neon pink). Reads warm, heritage, premium. **No pink anywhere.**

### Typography

- **Display / headings:** `Cormorant Garamond` (Google Fonts, serif). Used on H1/H2 for landing & PDP.
- **Body / UI:** `Inter`. Workhorse.
- **Tamil display accent:** `Catamaran`, loaded only on pages that render Tamil characters.
- **No** icon-style devotional fonts, no emoji.

### Iconography

- `lucide-react` for general UI (matches shadcn).
- Custom flat SVG line-art for category tiles (deepam, agarbatti, sambrani cup, brass lamp). Single-stroke, brass color. **Not** photoreal, not 3D, not stock illustrations.

### Motion (Framer Motion)

- Page transitions: 200 ms fade.
- Card hover: 4 px lift + brass-tinted shadow. No bouncy springs.
- Add-to-cart: 300 ms flame-flicker on the cart icon — one signature moment, used sparingly.

### Layout

- Mobile-first; max content width 1200 px on desktop.
- Generous whitespace — premium feel through breathing room, not ornament.
- Soft 6 px corner radius on cards/buttons. No 90° hard corners, no fully rounded pills.
- Product images on cream backgrounds (not white) so warmth carries through.

---

## 7. Catalog seed

### Top-level categories (8) and starter sub-categories (22)

```
Agarbatti / Incense Sticks      → Sandalwood (Chandan), Jasmine (Mallipoo),
                                   Rose (Roja), Mogra, Temple Blend
Sambrani / Dhoop                → Loban Cups, Sambrani Powder, Dhoop Sticks
Karpooram (Camphor)             → Pachai Karpooram (raw), Tablet Camphor
Vilakku (Lamps)                 → Kuthuvilakku, Nilavilakku, Hand Diya,
                                   Lamp Accessories
Pooja Oils                      → Nallennai (gingelly), Cow Ghee, Castor Oil
Thiri (Wicks)                   → Cotton Wicks, Long Wicks
Vibhuti / Sandal / Kumkum       → Vibhuti, Chandan paste, Kumkum
Gift Sets / Pooja Kits          → (no sub-cats; bundles)
```

### Slug rules

Category slugs are kebab-case English (`agarbatti`, `sambrani-dhoop`) for URL stability. The `name` field stores the display label and can include Tamil — slugs do not.

### Demo seed contents (`prisma/seed.ts`)

- All 8 top-level + 22 sub-categories above.
- **3 demo accounts** (so all role flows are demonstrable without registration). Default passwords below; if `ADMIN_SEED_PASSWORD` / `RESELLER_SEED_PASSWORD` / `CUSTOMER_SEED_PASSWORD` env vars are set, the seed uses those instead — that keeps the same seed file usable later for a non-demo cutover.
  - `admin@shri.local` / `admin123` — `User.role=Admin`
  - `reseller@shri.local` / `reseller123` — `User.role=Reseller`, joined `Reseller` row with `isVerified=true` (so B2B prices apply immediately)
  - `customer@shri.local` / `customer123` — `User.role=Customer`
- **15–20 sample products** spread across categories, each with stock 100, MRP, B2C price, B2B price (~25 % lower than B2C), 2–3 placeholder images.

---

## 8. Repo layout & build

```
shri-fragrance/
├── docker-compose.yml         # Postgres for local dev
├── prisma/
│   ├── schema.prisma          # 9 models from §3
│   └── seed.ts                # categories, demo accounts, sample products
├── src/
│   ├── app/                   # routes from §4
│   ├── components/
│   │   └── ui/                # shadcn primitives
│   ├── lib/
│   │   ├── auth.ts            db.ts          store.ts
│   │   ├── config.ts          errors.ts      rateLimit.ts
│   │   ├── logger.ts          email.ts       sms.ts
│   │   ├── blob.ts            cache.ts       retry.ts
│   │   └── circuit-breaker.ts
│   └── middleware.ts          # security headers, rate limits
├── tests/
│   └── unit/                  # Vitest — auth, pricing, validators
├── .env.example
├── tailwind.config.ts         # tokens from §6
└── package.json
```

### Environment variables (`.env.example`)

```
DATABASE_URL                postgres://shri:shri@localhost:5432/shri
JWT_SECRET                  openssl rand -hex 32
RESEND_API_KEY              (unused in demo; console logger active)
SMS_API_KEY                 (unused in demo; console logger active)
RAZORPAY_KEY_ID             test mode
RAZORPAY_KEY_SECRET         test mode
NEXT_PUBLIC_RAZORPAY_KEY_ID test mode
DEMO_PAYMENTS               true   ← bypasses HMAC verify, auto-marks paid
ADMIN_SEED_PASSWORD         optional override for seeded admin (default: admin123)
RESELLER_SEED_PASSWORD      optional override (default: reseller123)
CUSTOMER_SEED_PASSWORD      optional override (default: customer123)
NEXT_PUBLIC_SITE_URL        http://localhost:3000
```

`lib/config.ts` runs in **dev mode** for the demo — warns on missing keys instead of fail-fast.

### Build flags (deltas from Julex)

- `typescript.ignoreBuildErrors`: **false** (Julex sets true)
- `eslint.ignoreDuringBuilds`: **false**
- `optimizeFonts`: default (re-enable Julex's workaround only if we hit the same build hang)
- `output`: default (no standalone)

### Local run

```
git clone …
docker compose up -d           # Postgres
cp .env.example .env
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev                    # http://localhost:3000
```

### Out of scope for v1 (recorded so they don't sneak back in)

Reviews, coupons, referrals, push notifications, multi-language, WhatsApp OTP, page-view analytics, custom search endpoint, COD, two-domain split, in-app browser block, deployment to Vercel/any host.

---

## 9. Open questions

None at the time of writing. Anything that surfaces during planning should be appended here.
