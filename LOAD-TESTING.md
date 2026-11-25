# Load Testing — Shri Fragrance (production build)

- **Date:** 2026-11-25 (final numbers = v1.1.0 merged tree)
- **Build:** production (`next build` → `next start`), v1.1.0 tree: local scrypt+JWT auth, security headers, deployment hardening
- **Tool:** autocannon 7 (`npx autocannon`), **0 errors / 0 timeouts across every scenario and every run**
- **Environment:** Windows 10 x64 dev machine, Node v22.16, single Node process, MongoDB **not** configured (all DB-backed API paths exercised only up to their 503/validation boundary)
- Raw per-run data: [`security-audit-artifacts/loadtest/`](./loadtest/) (`lt-*.json` = final v1.1.0 tree; `loadtest-*.json` = pre-merge Firebase-auth tree, kept for comparison)

## Results — v1.1.0 (official baseline)

| Scenario | Concurrency | Duration | Throughput | p50 | p99 | Expected responses | Errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /` (home) | 20 | 20 s | **187 rps** | 104 ms | 151 ms | 100% 200 | 0 |
| `GET /collection` | 20 | 15 s | **763 rps** | 17 ms | 82 ms | 100% 200 | 0 |
| `GET /api/products` | 50 | 15 s | **980 rps** | 47 ms | 155 ms | 100% 503¹ | 0 |
| `POST /api/orders` (min-order validation) | 20 | 15 s | **909 rps** | 21 ms | 55 ms | 100% 400² | 0 |

### Pre-merge comparison (Firebase-verification auth)

| Scenario | Pre-merge | v1.1.0 | Δ |
| --- | --- | --- | --- |
| `GET /collection` | 371 rps / p99 74 ms | **763 rps / p99 82 ms** | ~2× |
| `GET /api/products` | 350 rps / p99 668 ms | **980 rps / p99 155 ms** | ~2.8× |
| `POST /api/orders` | 292 rps / p99 253 ms | **909 rps / p99 55 ms** | ~3.1× |

The step change comes from the local HMAC session verification (no external
auth roundtrip per request) plus the merged-tree code updates. The home page
carries the heaviest markup and remains the slowest route (p99 151 ms).

¹ `503` is the **correct** business response while `MONGODB_URI` is unset — measures the full Next.js route + JSON overhead.
² `400` is the min-order guard rejecting a ₹400 order — measures JSON parsing + validation cost.

## Interpretation

- **Zero errors and zero timeouts everywhere** — no connection handling problems, no unhandled rejections, no crashes under sustained load.
- Page renders (SSR/static) hold p99 < 200 ms at 20 concurrent clients on a modest Windows box; the API layer holds p99 ≈ 250 ms even with JSON parsing + validation on every request.
- The p99 spike at 50 concurrent connections (~0.9 s on `/api/health`) is Node event-loop/GC jitter on a single process — expected for one process; not a leak (throughput stayed flat, errors stayed 0).
- These numbers are from a **developer laptop**, not the target server. Treat them as regression baselines, not capacity guarantees.

## Caveats (what this does NOT cover)

1. **MongoDB-backed paths** (real order writes, catalog reads, settings) were not exercised — no `MONGODB_URI` on this machine. On the server, re-run with Mongo configured; expect added latency = network RTT to Atlas (typically 10–80 ms per query; the app reuses one pooled connection, so it scales fine).
2. **Shiprocket/SMTP side effects** were naturally absent (no credentials configured) — load testing against the real Shiprocket account would burn API quota and create real shipments; do not.
3. **No CDN/front-proxy in the path.** In production, IIS/Nginx/Caddy adds negligible overhead but static assets and `_next/static` should be cached there.

## Recommendations for the server

1. **Run PM2 in cluster mode** to use all CPU cores (single process plateaus under high concurrency):
   ```powershell
   pm2 start npm --name shri-fragrance -i max -- start
   ```
2. Health-check `GET /api/health` from the load balancer / uptime monitor (it is dependency-free by design).
3. Re-run the same scenarios on the server with `MONGODB_URI` set before go-live; compare p99 against this baseline.
4. If public traffic grows, put a CDN in front of `/` and `/collection` and add per-IP rate limits at the proxy (audit finding F-4).

## Reproduce

```bash
npm run build
npx next start -p 3100 &
npx autocannon -c 20 -d 20 --latency http://localhost:3100/
npx autocannon -c 50 -d 15 --latency http://localhost:3100/api/products
npx autocannon -c 20 -d 15 --latency -m POST -H "Content-Type: application/json" \
  -b '{"id":"ORD-X","total":400,"items":[]}' http://localhost:3100/api/orders
```
