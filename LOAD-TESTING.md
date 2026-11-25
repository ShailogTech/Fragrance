# Load Testing — Shri Fragrance (production build)

- **Date:** 2026-11-25
- **Build:** production (`next build` → `next start`), commit at the time of testing: pre-`v1.1.0` hardening tree
- **Tool:** autocannon 7 (`npx autocannon`), 0 errors / 0 timeouts across every scenario
- **Environment:** Windows 10 x64 dev machine, Node v22.16, single Node process, MongoDB **not** configured (all DB-backed API paths exercised only up to their 503/validation boundary)
- Raw per-run data: [`security-audit-artifacts/loadtest/`](./loadtest/)

## Results

| Scenario | Concurrency | Duration | Throughput | p50 | p99 | Expected responses | Errors |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `GET /` (home) | 20 | 20 s | **171 rps** | 114 ms | 177 ms | 100% 200 | 0 |
| `GET /collection` | 20 | 15 s | **371 rps** | 53 ms | 74 ms | 100% 200 | 0 |
| `GET /api/health` | 20 | 15 s | **365 rps** | 40 ms | 258 ms | 100% 200 | 0 |
| `GET /api/health` | 50 | 15 s | 287 rps | 125 ms | 960 ms | 100% 200 | 0 |
| `GET /api/products` | 50 | 15 s | **350 rps** | 103 ms | 668 ms | 100% 503¹ | 0 |
| `POST /api/orders` (min-order validation) | 20 | 15 s | **292 rps** | 59 ms | 253 ms | 100% 400² | 0 |

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
