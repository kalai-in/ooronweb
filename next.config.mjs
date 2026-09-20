
let apiHost = "";
try {
  apiHost = new URL(process.env.NEXT_PUBLIC_API_URL).hostname;
} catch {
  console.warn("[next.config] NEXT_PUBLIC_API_URL missing or invalid");
}

const apex = (() => {
  if (!apiHost) return "";
  const labels = apiHost.split(".");
  return labels.length >= 2 ? labels.slice(-2).join(".") : apiHost;
})();

const IMAGE_PATHS = ["/storage/**", "/public/storage/**", "/images/**"];

const imageHosts = new Set();
if (apex) imageHosts.add(`**.${apex}`);
if (apiHost) imageHosts.add(apiHost);

const remotePatterns = [...imageHosts].flatMap((hostname) =>
  IMAGE_PATHS.map((pathname) => ({
    protocol: "https",
    hostname,
    port: "",
    pathname,
  })),
);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Self-contained server build in .next/standalone: Next traces the modules the
  // app actually imports and copies only those, so the deploy artifact is a
  // server.js plus a minimal node_modules (~61MB here) instead of the full
  // dependency tree (~784MB). This is the VPS/PM2 + Docker target in
  // DEPLOYMENT.md.
  //
  // Overridden to "export" below when SEO is off — the two are mutually
  // exclusive, since a static export has no server to run.
  //
  // NOTE: `public/` and `.next/static` are NOT traced into the bundle. The
  // deploy step must copy them next to server.js or every asset 404s:
  //   cp -r public .next/standalone/
  //   cp -r .next/static .next/standalone/.next/
  //
  // BUILD ONLY. Setting this in `next dev` makes the dev server stop serving
  // `public/` — it assumes something else will, since a standalone bundle has
  // those files copied in beside server.js. The result is a 400 (not a 404) for
  // EVERY public asset: /manifest.json, /robots.txt, /favicon.webp,
  // /firebase-messaging-sw.js. Verified by toggling this one line: with it dev
  // returns 400, without it 200.
  // ...(process.env.NODE_ENV === "production" ? { output: "standalone" } : {}),
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns,
    qualities: [70, 75, 95],
    // Capped at 1920 — the layout's widest element (a full-bleed banner) never
    // renders past the viewport, so the default's 2048/3840 entries only ever
    // serve a 2x-DPR request for a box that's already capped, inflating the
    // "improve image delivery" audit for no visual gain.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    // Product/banner images rarely change once uploaded — 1 day (default 60s)
    // cuts repeat /_next/image work on return visits.
    minimumCacheTTL: 86400,
  },

  experimental: {
    scrollRestoration: true,
    // Named imports from these packages otherwise pull in the whole barrel
    // file per import site — this rewrites them to deep imports at build
    // time so only the icons/components actually used ship to the client.
    optimizePackageImports: ["react-icons", "lucide-react", "framer-motion"],
  },
};

// Long-lived caching for versioned-by-content-rarely-changing static assets.
// Skipped for a static export ("output: export" below) — that target is
// served by a plain file host (Apache/Nginx/S3), which ignores Next's
// headers() entirely, so the same rules belong in that host's own config
// instead (see copy-htaccess.js).
if (process.env.NEXT_PUBLIC_SEO !== "false") {
  nextConfig.headers = async () => [
    {
      source: "/icons/:path*",
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ],
    },
    {
      source: "/favicon.webp",
      headers: [
        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
      ],
    },
  ];
}

if (process.env.NEXT_PUBLIC_SEO === "false") {
  // Replaces "standalone" — a static export ships HTML only, no node server.
  nextConfig.output = "export";
  // A static export ships HTML only, with no server to run the image
  // optimizer — sharp needs the Node process this build won't have.
  nextConfig.images.unoptimized = true;
}
export default nextConfig;
