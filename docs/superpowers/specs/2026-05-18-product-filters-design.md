# Product Filters & Sort — Design

Date: 2026-05-18
Status: Approved (Approach A)

## Goal

Extend the `/products` page so users can filter by **price range** and use **more
sort options**, on top of the existing category filter and price asc/desc sort.

## Current State

`src/app/products/page.tsx` (RSC, `dynamic = "force-dynamic"`):
- Reads `searchParams.cat` and `searchParams.sort`.
- Prisma query filters `category.slug` when `cat !== "all"`; `orderBy` switches
  on `sort` (`price-asc` | `price-desc` | else `createdAt desc`).
- Renders category buttons via `ShopFilters.tsx` (client) and an inline
  `SortLink` row (Newest / Price ↑ / Price ↓).

`src/app/products/ShopFilters.tsx` (client): button row, pushes `cat` to the URL
via `useRouter` + `useSearchParams`, preserving other params.

## Approach

**Approach A — extend the existing URL-param + RSC pattern in place.** No new
state library, no client-side data fetching. All filter/sort state lives in the
URL query string; the server reads it and queries Prisma. Consistent with the
current category/sort implementation, SEO-friendly, shareable URLs.

## URL Parameters

| Param  | Existing? | Values |
|--------|-----------|--------|
| `cat`  | yes | category slug or absent (= all) |
| `sort` | yes | `new` (default) `price-asc` `price-desc` `name` `discount` |
| `min`  | new | integer rupees, absent = no lower bound |
| `max`  | new | integer rupees, absent = no upper bound |

## Price Filter — Preset Buckets

New client component `src/app/products/PriceFilter.tsx`, mirroring `ShopFilters`:
a button row that sets `min`/`max` in the URL, preserving all other params
(`cat`, `sort`).

Buckets:

| Label | min | max |
|-------|-----|-----|
| All | (delete both) | |
| Under ₹200 | — | 200 |
| ₹200–500 | 200 | 500 |
| ₹500–1000 | 500 | 1000 |
| ₹1000+ | 1000 | — |

Active bucket = the one whose `min`/`max` matches current params (compare as
strings the same way `ShopFilters` compares `cat`). Setting a bucket deletes the
other bound when that bound is open (e.g. "Under ₹200" deletes `min`, sets
`max=200`).

Server side in `page.tsx`: parse `min`/`max` with `Number`; if `Number.isFinite`
and `>= 0`, add to the Prisma `where`:

```ts
price: {
  ...(hasMin ? { gte: min } : {}),
  ...(hasMax ? { lte: max } : {}),
}
```

Only attach the `price` key when at least one bound is valid. Non-numeric /
negative values are ignored (treated as absent), no error shown.

## Sort — Add Two Options

Existing: `new`, `price-asc`, `price-desc`. Add:

- `name` → Prisma `orderBy: { name: "asc" }`.
- `discount` → biggest `(mrp - price) / mrp` first. SQLite + Prisma cannot
  `orderBy` a computed expression cleanly. Products are fully fetched (no
  pagination), so: query with a stable `orderBy` (e.g. `createdAt desc`), then
  sort the resulting array in JS by discount ratio descending before render.
  All other sorts continue to use Prisma `orderBy`.

`SortLink` in `page.tsx` gets two more entries (Name A–Z, Discount).

## Param Preservation (important)

Current `SortLink` builds its href from `activeCat` only — it drops any other
params. After this change `SortLink` must preserve **all** current params
(`cat`, `min`, `max`) and only change `sort`. Likewise `PriceFilter` preserves
`cat` and `sort`, and `ShopFilters` already preserves others via
`new URLSearchParams(params.toString())` — keep that approach in all three so no
filter resets another.

Recommended: each control starts from the full current querystring, mutates only
its own key(s), deletes a key when the value is the default/"all".

## Components Touched

| File | Change |
|------|--------|
| `src/app/products/page.tsx` | Parse `min`/`max`; extend `where` with price; add `name`/`discount` sort (discount = JS post-sort); extend `SortLink` to preserve all params + 2 new links; render `<PriceFilter>` |
| `src/app/products/PriceFilter.tsx` | **New** client component, bucket button row |
| `src/app/products/ShopFilters.tsx` | No logic change; verify it still preserves new params (it uses full querystring already — OK) |

## Data Flow

User clicks bucket / sort → client component pushes new URL → RSC `page.tsx`
re-renders with new `searchParams` → Prisma query (+ optional JS discount sort)
→ product grid re-renders. No client cache, no Zustand.

## Error Handling

- Invalid `min`/`max` (NaN, negative): ignored, query runs unfiltered on price.
- `min > max`: query returns empty set naturally; "No fragrances found" empty
  state already handles this — acceptable, no special message.
- `discount` sort with products where `mrp <= price` or `mrp = 0`: ratio clamps
  to `0` (no negative/NaN); guard division by zero (`mrp > 0 ? ... : 0`).
- Empty result: existing empty-state block already covers it.

## Testing

No test harness exists in the repo (Vitest installed, no config/scripts).
Verification is manual via the running dev server:

1. `/products?min=200&max=500` → only products priced 200–500.
2. Click each bucket → URL updates, grid filters, active bucket highlighted.
3. `sort=name` → alphabetical; `sort=discount` → highest discount % first.
4. Apply category + price bucket + sort together → all three hold; changing one
   does not reset the others (param-preservation check).
5. `min=abc` → ignored, full list shown, no crash.

## Out of Scope (YAGNI)

On-sale-only filter, in-stock-only filter, best-sellers sort, dual slider,
min/max numeric inputs, sidebar panel layout. Not requested for this iteration.
