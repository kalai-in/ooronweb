
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
    unoptimized: true,
  },

  experimental: {
    scrollRestoration: true,
  },
};

if (process.env.NEXT_PUBLIC_SEO === "false") {
  // Replaces "standalone" — a static export ships HTML only, no node server.
  nextConfig.output = "export";
}
export default nextConfig;
