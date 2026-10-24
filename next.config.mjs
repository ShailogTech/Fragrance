/** @type {import('next').NextConfig} */
const nextConfig = {
  // The deploy watcher (scripts/deploy-watch.mjs) builds into .next-new and
  // swaps it in only after a successful build, so a broken build can never
  // take down the serving .next directory.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "placehold.co" },
      { protocol: "https", hostname: "upload.wikimedia.org" },
    ],
  },
};

export default nextConfig;
