# Premium Smoothness — Phase 1: Route + Image Polish

Date: 2026-05-18
Status: Approved (Approach A)

## Goal

Make the site *feel* premium by removing two sources of visual friction:

1. **Abrupt route swaps** — clicking a nav link or product card currently
   flashes white/cuts to the new page with no transition or loading state.
2. **Image pop-in** — raw `<img>` tags load and snap into place, no blur
   placeholder, no fade.

Phase 2 (cart toast, scroll-reveal stagger, micro-press on filter buttons) is
out of scope here.

## Current State

`globals.css` already provides a rich motion vocabulary: `lift`, `cta-gold`,
`bronze-card`, `candle-glow`, `breathe`, `embers`, `reveal`/`reveal-scale`,
premium scrollbar, smooth `transition-*` defaults on a/button/etc. The
foundation is solid — Phase 1 plugs the two holes that survive that polish.

Raw `<img>` tags exist in 7 files:

- `src/components/ProductCard.tsx` (2 spots — featured + standard)
- `src/app/products/[slug]/ProductDetail.tsx`
- `src/app/admin/page.tsx`
- `src/app/admin/products/page.tsx`
- `src/app/admin/products/AddProductDialog.tsx`
- `src/app/wishlist/page.tsx`
- `src/app/cart/page.tsx`

No `loading.tsx` files exist anywhere. `next.config.mjs` is empty. The
`framer-motion` dependency is installed but unused.

## Approach

**Approach A — Next App Router primitives + `next/image` + small CSS layer.**

No new dependencies. No framer-motion adoption. Uses Next's built-in
`loading.tsx` streaming + a small client `PageTransition` wrapper for fade-in.
CSS-driven shimmer skeletons match the existing temple palette.

## 1. Page Fade-in Wrapper

New client component `src/components/PageTransition.tsx`:

- Reads `usePathname()` from `next/navigation`.
- Renders `<div key={pathname} className="page-enter">{children}</div>`. The
  key change on route swap remounts the wrapper, retriggering the CSS
  animation.
- No state, no effects, purely renders + key.

Mount in `src/app/layout.tsx` by wrapping the existing
`<main className="flex-grow">{children}</main>` content with
`<PageTransition>`.

`globals.css` adds:

```css
.page-enter {
  animation: page-enter-anim 600ms cubic-bezier(0.22, 1, 0.36, 1) both;
  will-change: opacity, transform;
}
@keyframes page-enter-anim {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .page-enter { animation: none; }
}
```

## 2. Route Loading Skeletons

Three new files, each Server Component (no `"use client"`):

- `src/app/products/loading.tsx` — header placeholder + 8-card grid skeleton.
- `src/app/products/[slug]/loading.tsx` — image placeholder + title/price/button bars.
- `src/app/admin/loading.tsx` — sidebar + table/grid placeholder block.

Skeletons reuse existing classes (`bronze-card`, `weathered-border`, grid
layout) plus a new shimmer class:

```css
.shimmer {
  position: relative;
  overflow: hidden;
  background: rgba(40, 28, 8, 0.4);
}
.shimmer::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(
    90deg,
    transparent 0%,
    rgba(247, 189, 72, 0.06) 50%,
    transparent 100%
  );
  transform: translateX(-100%);
  animation: shimmer-sweep 1.6s linear infinite;
}
@keyframes shimmer-sweep {
  to { transform: translateX(100%); }
}
@media (prefers-reduced-motion: reduce) {
  .shimmer::after { animation: none; }
}
```

Streaming behaviour comes free from Next App Router — these `loading.tsx`
files are served instantly while the RSC tree streams.

## 3. `next/image` Swap

Replace `<img>` in all 7 files. Each call site:

```tsx
import Image from "next/image";

<Image
  src={image}
  alt={name}
  fill                       // for fixed-aspect containers
  sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
  className="object-cover ..." // existing classes
  placeholder="blur"
  blurDataURL={SOLID_DARK}   // shared 10-byte base64 dark pixel
/>
```

- `SOLID_DARK` constant in `src/lib/utils.ts`: `data:image/png;base64,...` of
  a 1×1 `#1a120a` pixel (matches background). Single import everywhere.
- Use `fill` where containers have explicit `width` + `height` via CSS (most
  of our cards). Otherwise pass explicit `width`/`height` props (admin tables).
- Mark above-the-fold hero image (ProductDetail main image, products page
  first card if applicable) with `priority`.

`next.config.mjs` update:

```js
const nextConfig = {
  images: {
    remotePatterns: [
      // none yet — all uploads served same-origin via /api/uploads/*
    ],
  },
};
```

Same-origin URLs (`/api/uploads/...`) work without `remotePatterns`. The
config block is added now so future remote URLs (e.g. CDN) only need a single
edit. Leave the array empty until a remote source is introduced.

## 4. Scroll Restoration

App Router already restores scroll on back/forward and resets to top on
forward nav. `globals.css` already has `scroll-behavior: smooth`. No change.

## Components Touched

| File | Change |
|------|--------|
| `src/components/PageTransition.tsx` | **New** client wrapper, keys children by pathname |
| `src/app/layout.tsx` | Wrap `{children}` in `<PageTransition>` |
| `src/app/globals.css` | Add `.page-enter` + `@keyframes` + `.shimmer` + reduced-motion guards |
| `src/app/products/loading.tsx` | **New** skeleton |
| `src/app/products/[slug]/loading.tsx` | **New** skeleton |
| `src/app/admin/loading.tsx` | **New** skeleton |
| `src/components/ProductCard.tsx` | `<img>` → `<Image>` ×2 |
| `src/app/products/[slug]/ProductDetail.tsx` | `<img>` → `<Image>` |
| `src/app/admin/page.tsx` | `<img>` → `<Image>` |
| `src/app/admin/products/page.tsx` | `<img>` → `<Image>` |
| `src/app/admin/products/AddProductDialog.tsx` | `<img>` → `<Image>` (preview thumbnail) |
| `src/app/wishlist/page.tsx` | `<img>` → `<Image>` |
| `src/app/cart/page.tsx` | `<img>` → `<Image>` |
| `src/lib/utils.ts` | Export `SOLID_DARK` blurDataURL constant |
| `next.config.mjs` | Add `images.remotePatterns: []` scaffold |

## Edge Cases

- **Empty / broken image URLs:** `next/image` errors hard on empty `src`. Each
  call site already guards via `parseImages(p.images)[0] ?? ""`; replace the
  empty-string fallback with a conditional render (skip `<Image>` when no src)
  or use a bundled `/images/placeholder.png` asset. Pick conditional render —
  no new asset needed.
- **Admin upload previews:** `AddProductDialog` shows just-uploaded blob URLs
  during edit. `next/image` rejects `blob:` URLs without `unoptimized`. Use
  `<Image unoptimized />` for previews of unsaved uploads only.
- **Reduced motion:** every animation has a `prefers-reduced-motion: reduce`
  guard.
- **CLS:** `next/image` with `fill` requires a positioned container with
  defined dimensions — all current cards already have `h-3/5`, `h-[500px]`
  etc., so layout shift stays at zero.
- **Page transition flicker on hash navigation:** `usePathname` does not
  change for hash-only URL changes — key stays stable — no flicker. Good.

## Verification (manual, dev server)

1. Cold-load `/` → main fades up 8px → 0px over 600ms.
2. Click `/products` → instant skeleton renders (grid placeholders shimmer) →
   real grid streams in and fades up. No white flash.
3. Click a product card → product detail skeleton → real page fades up.
4. Refresh `/admin` (slow 3G in DevTools) → admin skeleton visible.
5. Product card images: hard refresh, watch hero card — blur dark pixel →
   sharp image fades in.
6. Toggle `prefers-reduced-motion` in DevTools → no animations run, content
   appears instantly.
7. Wishlist + cart + admin product list pages — images render via
   `next/image`, no console warnings.

## Out of Scope (YAGNI)

- View Transitions API / `next-view-transitions` package.
- framer-motion adoption (decide later whether to keep the dep at all).
- Scroll-linked parallax beyond what `TempleBackdrop` already does.
- Add-to-cart toast / bag-count bump (Phase 2).
- Scroll-reveal stagger on product grid (Phase 2).
- Filter button spring press (Phase 2).
- Replacing temple SVG mandalas / textures.
- Remote image CDN setup — config stub added, content unchanged.
