# Shri Fragrance — E-commerce (Next.js)

Full storefront + admin dashboard with its own e-mail/password sign-in,
MongoDB persistence, Shiprocket shipping, transactional email, and a ₹500 minimum
order. Designed to run as a Node server (e.g. self-hosted Windows).

## Admin access

- **URL:** `/admin` (sign in on `/login` first — the dashboard switches to the
  admin view automatically)
- **Admin identity:** the address listed in `ADMIN_EMAILS` in `.env`. Admin
  rights are tied to it, and it is not stored anywhere in the repository.
- **Password:** create or reset the account with `node scripts/seed-admin.mjs`
  (prints a generated password once, or pass your own). Changing the password
  signs out every device.

## Configuration (Admin → Settings)

All credentials are entered in the admin panel and stored in MongoDB — no
redeploy needed:

1. **Delivery Partner — Shiprocket:** email + password from
   [app.shiprocket.in → Settings → Integrations → API](https://app.shiprocket.in/settings/account-details/integration),
   plus your pickup pincode and pickup location name. New orders are pushed to
   Shiprocket automatically; customers can track shipments from the dashboard.
2. **Email & Notifications:** SMTP details (Brevo, SendGrid, Gmail app
   password, or your own mail server — host, port, TLS mode, username,
   password), the from-address, the owner notification email, and the public
   site URL. Once active:
   - customers receive an **order confirmation** when they order,
   - the owner receives a **new-order alert**,
   - customers receive a **shipping/tracking email** when an order is marked
     *Shipped* (includes courier + AWB when Shiprocket assigned one).

## Environment

Create `.env` in the project root:

```
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net
# Required: session signing secret (generate: node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
AUTH_SECRET=<64+ hex chars>
# Required: the address that runs the store (admin rights are tied to it)
ADMIN_EMAILS=<you@yourdomain>
# optional overrides
MONGODB_DB=shrifragrance
PORT=3000
```

## Run locally

```bash
npm install
npm run dev        # http://localhost:3000
```

## Deploy on a Windows server

The app needs a running Node process (API routes are server-rendered).

```powershell
npm install
npm run build      # produces .next
npm start          # next start -p 3000
```

To keep it running as a service (auto-start on boot, restart on crash), use
**PM2 in cluster mode** — it uses every CPU core and restarts on crash:

```powershell
npm install -g pm2 pm2-windows-startup
pm2 start npm --name shri-fragrance -i max -- start
pm2 save
pm2-startup install
```

Then put IIS/Nginx/Caddy in front as a reverse proxy to `:3000` for HTTPS
(per-IP rate limiting at the proxy is recommended — see the security audit).
Recommended Node LTS (20+, enforced by the `engines` field).

**Health check:** `GET /api/health` → `{ ok, uptimeSec, mongo, timestamp }` —
dependency-free liveness probe for uptime monitors and load balancers.
**Load testing:** see [`LOAD-TESTING.md`](LOAD-TESTING.md) for the tested
baseline (autocannon, zero errors) and how to reproduce it on the server.

## Key routes

| Area | Route |
| --- | --- |
| Storefront | `/` · `/collection` · `/cart` · `/checkout` |
| Customer | `/login` · `/signup` · `/dashboard` (orders, wishlist, profile, tracking) |
| Admin | `/admin` (dashboard, products, orders, customers, analytics, settings) |

## Security notes

See `security-audit-artifacts/SECURITY-AUDIT.md` for the full audit. API
routes verify the session cookie against the account it belongs to; SMTP and Shiprocket passwords
are write-only secrets stored in the `settings` MongoDB collection.
