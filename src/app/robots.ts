import type { MetadataRoute } from "next";

// This is a white-label template deployed per-client, each on its own domain
// (NEXT_PUBLIC_BASE_URL) — a static public/robots.txt bakes in whichever
// client's domain it was last committed under, so the Sitemap: line ends up
// pointing at a DIFFERENT client's site once redeployed elsewhere. Generating
// this from the env var keeps it correct on every deploy without a manual edit.
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_BASE_URL || "").replace(/\/+$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
