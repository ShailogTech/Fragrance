# Shri Fragrance — Landing Page

A completely **serverless** landing page for Shri Fragrance (sacred South Indian
agarbathi), with a built-in content manager for adding and deleting products.

There is **no backend**: no Node server, no database, no API keys required to run
the site. The whole site is a static export that can be hosted for free anywhere,
and the product catalog lives in a JSON file inside this very repository.

## How it works

```
public/products.json  ←  single source of truth (committed to this repo)
        ↑ read                    ↑ write
        |                         |
  Landing page (/)          Admin CMS (/admin/)
  baked at build time,      commits products.json via
  then refreshed live from  the GitHub Contents API
  raw.githubusercontent.com with a personal access token
```

- **Landing page (`/`)** — hero, product grid, heritage and contact sections.
  The catalog copy baked at build time renders instantly; the page then pulls
  the latest JSON from `raw.githubusercontent.com`, so admin edits appear
  within a minute or so without redeploying.
- **Product Manager (`/admin/`)** — connect with a GitHub fine-grained
  personal access token, then **add** or **delete** products. Every action is
  a commit to `public/products.json`. The token is stored only in the
  admin's browser (localStorage).

Orders/enquiries happen over phone, WhatsApp, and email (buttons on the page) —
there is deliberately no cart or checkout.

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
```

## Build & host (fully static)

```bash
npm run build      # produces out/
npm run preview    # serve the export locally
```

Deploy `out/` to any static host:

| Host | How |
| --- | --- |
| **Vercel** | Import the repo — Next.js is auto-detected; static export is emitted. |
| **Netlify** | Build command `npm run build`, publish directory `out`. |
| **GitHub Pages (project site)** | Build with `NEXT_PUBLIC_BASE_PATH=/Fragrance npm run build`, publish `out/` (e.g. via Actions). The site then lives at `https://<user>.github.io/Fragrance/`. |

## Managing products (admin)

1. Open `/admin/` (link in the footer: *Product Manager*).
2. Create a **fine-grained personal access token**:
   <https://github.com/settings/personal-access-tokens/new>
   - Repository access → *Only select repositories* → this repo.
   - Permissions → *Contents: Read and write*.
3. Paste the token, check the owner/repo/branch fields, and **Connect**.
4. Add a product (name, category, price, image URL, description) or delete
   one. Each action commits `public/products.json`; the commit link is shown.

To point the admin at a fork, just change the owner/repo/branch fields before
connecting, and update `DEFAULT_GH` in `src/lib/products.ts` so the landing
page reads the same repo.

## Repo layout

```
public/products.json     ← catalog (source of truth)
src/app/page.tsx         ← landing page
src/app/admin/page.tsx   ← product manager (add/delete)
src/lib/products.ts      ← catalog read (baked + live) & GitHub write helpers
public/images/           ← bundled product & brand images
```
