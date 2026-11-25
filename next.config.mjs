/** @type {import('next').NextConfig} */
const nextConfig = {
  // The deploy watcher (scripts/deploy-watch.mjs) builds into .next-new and
  // swaps it in only after a successful build, so a broken build can never
  // take down the serving .next directory.
  distDir: process.env.NEXT_DIST_DIR || ".next",

  // Don't advertise the framework version in responses.
  poweredByHeader: false,

  // Baseline security headers on every response. A strict CSP is
  // deliberately NOT set here: the app renders inline <style> blocks and
  // loads Google Fonts, so a CSP needs careful tuning — add one only with
  // a report-only rollout first.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
          // Harmless over plain HTTP (browsers ignore it); protects all
          // HTTPS deployments (IIS/Nginx/Caddy TLS termination).
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
        ],
      },
    ];
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
    ],
  },
};

export default nextConfig;
