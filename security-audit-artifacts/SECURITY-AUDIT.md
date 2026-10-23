# Security Audit — Shri Fragrance (Next.js e-commerce)

- **Date:** 2026-10-22
- **Scope:** Full white-box review after the Shiprocket integration + ₹500 minimum-order change (commit `65dd5ad`), covering `src/`, API routes, client libs, dependencies, and secrets handling.
- **Method:** `forge-skills:forge-security-review` rule set (global baseline + authn-authz, injection, secrets-storage, egress, tenant-isolation, misc indexes) adapted to this stack; manual source→sink tracing; `npm audit`; secret-pattern grep.
- **Skill scanner note:** the skill's static-analysis script (`run_static_analysis.ps1`, Atlassian FSRT) hard-requires a Forge `manifest.yml` and is inapplicable to this Next.js app — documented as an evidence gap; equivalent checks (npm audit, secret scan) were run instead.

## Executive summary

| Severity | Count | Notable |
| --- | --- | --- |
| High | 2 | Authenticated price tampering in order creation; claimable admin email (conditional) |
| Medium | 3 | No order-schema allowlist (Mongo field injection); no rate limiting; plaintext Shiprocket password in DB |
| Low / Info | 5 | Vulnerable-but-unused deps, misleading payment copy, client-side gates, dead `dangerouslySetInnerHTML`, public Firebase web key |

**Remediated during this change (was Critical before):** every API route previously trusted client-supplied `uid`/`email`. Anyone could read **all orders incl. customer PII** (`GET /api/orders?all=1&email=admin@shrifragrance.com`), change any order status, and rewrite the product catalog — without any credentials. All routes now verify Firebase ID tokens server-side (`src/lib/server-auth.ts`), verified by smoke tests (401 on missing/garbage tokens on every protected route).

---

## Confirmed findings

### F-1 · HIGH — Authenticated users can tamper with order totals (CWE-345, CWE-20)

- **Where:** `src/app/api/orders/route.ts` `POST` — the items/total consistency check runs only inside `if (!user)` (guest branch). Signed-in users skip it entirely, and **no** path validates item prices against the product catalog.
- **Trace:** client `addOrder()` (client-controlled `items[].price`, `total`) → `POST /api/orders` → token verified (passes) → `$set: { ...order }` stored as-is.
- **PoC:** with any valid account token:
  ```bash
  curl -X POST https://<host>/api/orders \
    -H "Authorization: Bearer <idToken>" -H "Content-Type: application/json" \
    -d '{"id":"ORD-PWN1","total":500,"items":[{"name":"Sandal","price":9999,"quantity":5}]}'
  ```
  → order stored with ₹50,000 of goods for a declared ₹500 (COD fraud vector).
- **CVSS 3.1:** `AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N` = **6.5** (business-critical despite the band; registration is open, so PR:L ≈ PR:N in practice).
- **Fix:** recompute `total` server-side from the `products` collection (unit prices × quantities + shipping rule), ignoring client prices; apply the guest item-consistency check to all orders.

### F-2 · HIGH (conditional) — Admin email is claimable via open signup (CWE-284, CWE-306)

- **Where:** `src/lib/server-auth.ts` (`ADMIN_EMAILS = {'admin@shrifragrance.com'}`) + open self-service signup (`src/lib/auth.ts` `signup()` → Firebase `createUserWithEmailAndPassword`, no email verification enforced anywhere server-side).
- **Exploit:** if `admin@shrifragrance.com` is not already registered in the Firebase project, an attacker simply registers it → verified Bearer token with admin email → full admin API access (store settings incl. Shiprocket credential changes, all customer orders/PII, catalog rewrite, order status changes).
- **Verify (owner, in Firebase Console → Authentication → Users):** confirm the admin account exists with a strong password + MFA; check whether "email enumeration protection" and email verification are on.
- **CVSS 3.1 (if unclaimed):** `AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N` = **8.8**.
- **Fix:** claim the account now; longer term move the admin role to Firebase custom claims (verified out-of-band) instead of an email string allowlist.

### F-3 · MEDIUM — Order document written without a field allowlist (CWE-20; Mongo field/operator injection)

- **Where:** `src/app/api/orders/route.ts` — `{ $set: { ...order, _id: order.id } }` spreads arbitrary client JSON keys into the update. Dotted keys (e.g. `"shipping.provider"`, `"customer.email"`) are interpreted as nested paths; guests can also set `status`, `createdAt`, etc. (only `uid` is stripped).
- **CVSS 3.1:** `AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:L/A:N` = **4.3** (higher if combined with F-1).
- **Fix:** pick an explicit allowlist of fields (`id, items, total, payment, customer, shipment, createdAt, status:'Processing', userEmail, uid`) and store only those.

### F-4 · MEDIUM — No rate limiting; Firebase lookup amplification (CWE-770)

- **Where:** all routes under `src/app/api/**`. Guest `POST /api/orders` accepts unlimited (validated) order creation; every authenticated request triggers an outbound `identitytoolkit` verification call, so unauthenticated traffic to protected routes costs one Firebase call each.
- **CVSS 3.1:** `AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L` = **5.3** (spam/abuse and cost vector).
- **Fix:** add per-IP/per-uid throttling (edge middleware or a small sliding-window in Mongo), cache token verifications for ~60s, and add basic bot checks to checkout.

### F-5 · MEDIUM — Shiprocket password stored plaintext in MongoDB (CWE-256, CWE-312)

- **Where:** `src/lib/settings.ts` stores `shiprocket.password` (and cached `token`) as plain strings in the `settings` doc.
- **Mitigations already present:** the value is write-only through the API (`publicSettings()` strips secrets; verified), route is admin-token-gated, Atlas provides encryption at rest.
- **CVSS 3.1:** `AV:N/AC:H/PR:H/UI:N/S:U/C:H/I:H/A:N` = **5.9** (requires DB read access first).
- **Fix:** prefer a server-side env var for the password, or encrypt with a key held in env; ensure DB access logs/audits are on; rotate the Shiprocket password if the DB was ever exposed.

### F-6 · LOW — Vulnerable/unused production dependencies (CWE-1104)

- `npm audit` (full tree): **14 high / 4 moderate**, including `@grpc/grpc-js` (via `mongodb`), `js-yaml`, `deepmerge-ts`, `prismjs` (via `react-syntax-highlighter`), `sharp`/libvips.
- **Notable:** `react-syntax-highlighter`, `react-markdown`, `@mdxeditor/editor` are imported by **nothing** in `src/` (verified by grep) — they exist only as attack/audit surface.
- **Fix:** remove unused deps (biggest easy win), then `npm audit fix`; keep `mongodb`/`grpc-js` current. Full detail: `security-audit-artifacts/npm-audit.json`.

### F-7 · LOW — Misleading payment-method UI (CWE-359 risk if a gateway is added carelessly)

- Checkout collects card number/CVV/UPI ID into React state with "Payments are encrypted and never stored" copy. No gateway exists; the data is never persisted (verified — `addOrder()` stores only the method string). The copy over-promises, and the form invites users to type card data into a non-PCI surface.
- **Fix:** remove card/UPI fields until a real gateway (Razorpay/Cashfree) is integrated; keep COD.

### F-8 · INFO — Residual client-side-only gates

- Admin/dashboard UI gates use the localStorage session (`session.role`), which is spoofable in devtools — but all privileged *actions* now require verified tokens server-side, so this is cosmetic UI exposure only.

### F-9 · INFO — Dead component with `dangerouslySetInnerHTML`

- `src/components/ui/chart.tsx` (stock shadcn chart, zero importers) injects CSS from config props. Unused → not reachable; delete to shrink surface.

### F-10 · INFO — Firebase web API key committed in source

- `src/lib/firebase.ts` — public client config by design, not a secret. Restrict it in Google Cloud Console (HTTP referrer allowlist, API restrictions) to prevent abuse of other enabled Google APIs under this project's quota.

---

## What checked out clean

- **Auth retrofit:** every protected route (`orders` GET/PATCH, `cart`, `wishlist`, `products` PUT, `admin/settings`, `shiprocket/track`) returns 401 without/with-invalid tokens; ownership enforced from the verified token (`uid`), admin allowlist enforced server-side.
- **Tenant isolation:** carts/wishlists/orders keyed by verified `uid`; tracking is owner-or-admin; no client-supplied identifiers reach Mongo filters.
- **SSRF/egress:** server-side `fetch` destinations are fixed constants (Shiprocket API, Firebase identitytoolkit); no user-controlled URLs reach server fetches. Product image URLs are client-rendered `<img>` only.
- **XSS/RCE:** no `eval`/`new Function`; single `dangerouslySetInnerHTML` in dead code (F-9); React escaping everywhere else.
- **Secrets:** no hardcoded credentials in `src/`; Shiprocket login errors log messages only, never payloads (`src/app/api/orders/route.ts` warns with order id + error message).
- **Min-order enforcement:** `₹500` rejected server-side even without Mongo configured (verified: `400 Minimum order value is ₹500.`) and mirrored in cart/checkout UI.

## Assumptions & evidence gaps

1. Forge FSRT scanner inapplicable (no `manifest.yml`); `npm audit` + manual review substituted.
2. MongoDB not configured locally — DB-path behavior verified only up to the 503 boundary; the Mongo writes themselves were reviewed statically.
3. Firebase project posture (is the admin email claimed? email-verification/enumeration settings) is not observable from the repo — F-2 must be verified in the Firebase console.
4. Shiprocket API contract from vendor docs (apiv2 `/external`); live calls untested pending credentials.

---

# Addendum — Re-audit 2026-10-23 (pre-deployment)

Re-run after the email/notification service (commit `6517c94`) and again after the
pre-deployment hardening below.

## New findings from the email service (found this pass)

| ID | Severity | Finding | Status |
| --- | --- | --- | --- |
| F-11 | Medium | **nodemailer ≤10.0.9** carried 14 advisories (SMTP/CRLF injection, DKIM DoS, TLS validation, etc.) | **Fixed** — upgraded to 10.2.1 |
| F-12 | Medium | **Email header injection (CWE-93)**: unvalidated `order.id`/`customer.email` flowed into `Subject`/`To`; signed-in users' ids were never format-checked, so CRLF could inject headers | **Fixed** — every header value passes `sanitizeHeader()` (strips CR/LF/control chars, caps length) and recipients must match an email regex; `order.id` now regex-validated for all callers |
| F-13 | Low | Unused dependency chains (`next-auth` — which also pinned vulnerable nodemailer@7 via peer dep, `react-syntax-highlighter`→prismjs, `react-markdown`, `@mdxeditor/editor`, `prisma`/`@prisma/client` + `src/lib/db.ts`) | **Fixed** — all removed; `npm audit` dropped from **20 vulns (16 high)** to **10 (10 high)**; the remainder sit in the Next.js/Mongo/Firebase toolchain — keep patching via `npm audit fix` on schedule |

## Previously open findings — now fixed for deployment

- **F-1 (High, price tampering): FIXED.** `POST /api/orders` now recomputes every line item's price from the `products` collection and rebuilds the total server-side (items + shipping rule); unknown product ids are rejected; quantities clamped 1–99; the min-order check re-runs on the recomputed total. Client-supplied prices/totals are never stored. The home-page "Complete Pooja Collection" bundle (id 999) was added to the seed catalog so it prices correctly.
- **F-3 (Medium, field injection): FIXED.** Only an explicit allowlist of fields (`id, items, total, status, payment, uid, userEmail, createdAt, customer{name,email,phone}, shipment{address,city,state,pincode,notes,method}`) reaches Mongo's `$set`; `uid`/`userEmail` come from the verified token, not the payload; strings length-capped.

## Still open (accepted / owner action)

- **F-2 (High, conditional)**: admin email `admin@shrifragrance.com` confirmed **claimed** in Firebase (signup returned EMAIL_EXISTS; reset email issued 2026-10-22). Owner must set a strong password from that mailbox and enable MFA.
- **F-4 (Medium)**: no rate limiting — recommend adding per-IP throttling at the reverse proxy (IIS/Nginx) before public launch.
- **F-5 (Medium)**: Shiprocket + SMTP passwords stored plaintext in the `settings` Mongo doc (write-only via API, admin-gated). Acceptable for launch with Atlas at-rest encryption; rotate if DB exposure is ever suspected.
- **F-7 (Low)**: checkout still shows card/UPI fields with no gateway behind them — remove before accepting real card data, or integrate a PCI gateway.

## Verification

- `tsc --noEmit` clean; production build passes (API routes server-rendered).
- Runtime smoke: ₹400 order → `400 Minimum order value is ₹500.`; malformed id → `400 Invalid order id.`; valid guest order → 503 (Mongo unset, expected pre-config); all protected APIs → 401 without token; pages 200.
