# Shri Fragrance — E-commerce (Next.js)

Full storefront + admin dashboard with Firebase authentication, MongoDB Atlas
persistence, Shiprocket shipping, transactional email, and a ₹500 minimum
order. Designed to run as a Node server (e.g. self-hosted Windows).

## Admin access

- **URL:** `/admin` (sign in on `/login` first — the dashboard switches to the
  admin view automatically)
- **Login email:** `admin@shrifragrance.com`
- **Password:** managed in **Firebase Console → Authentication → Users** (use
  *Reset password* there, or the forgot-password link on `/login`, which emails
  `admin@shrifragrance.com`). Admin rights are tied to this email.

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
# optional overrides
MONGODB_DB=shrifragrance
FIREBASE_API_KEY=<public web key, already defaulted in code>
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
**PM2**:

```powershell
npm install -g pm2 pm2-windows-startup
pm2 start npm --name shri-fragrance -- start
pm2 save
pm2-startup install
```

Then put IIS/Nginx/Caddy in front as a reverse proxy to `:3000` for HTTPS.
Recommended Node LTS (20+).

## Key routes

| Area | Route |
| --- | --- |
| Storefront | `/` · `/collection` · `/cart` · `/checkout` |
| Customer | `/login` · `/signup` · `/dashboard` (orders, wishlist, profile, tracking) |
| Admin | `/admin` (dashboard, products, orders, customers, analytics, settings) |

## Security notes

See `security-audit-artifacts/SECURITY-AUDIT.md` for the full audit. API
routes verify Firebase ID tokens server-side; SMTP and Shiprocket passwords
are write-only secrets stored in the `settings` MongoDB collection.
