import type { NextConfig } from "next";

// Fully static export (`out/`) — host it on any static file server:
// GitHub Pages, Vercel, Netlify, Cloudflare Pages, even `npx serve out`.
// There is no Node server: products are managed from /admin via the
// GitHub API and read live from raw.githubusercontent.com.
//
// For a GitHub Pages *project* site (https://<user>.github.io/Fragrance/)
// build with:  NEXT_PUBLIC_BASE_PATH=/Fragrance npm run build
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  basePath,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
