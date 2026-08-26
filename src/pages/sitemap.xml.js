import axios from "axios";
import { getZonesCached, requestChannel } from "@/api/zoneResolver";
import { getProductsServer } from "@/api/serverApi";
import { getPolygonCenter } from "@/utils/helperFunction";
import * as apiEndPoints from "@/api/apiEndpoints";

// Zone-aware sitemap, generated per request (cached below).
//
// Replaces scripts/generator.js's static public/sitemap.xml for zone URLs: that
// script only runs under `npm run export`, never `npm run build`, so its output
// is a stale committed file with no zone URLs in it.
//
// Emits:
//   the static marketing/legal routes (previously the whole sitemap),
//   un-zoned /blog/{slug} and /categories/{slug} (zone-independent content — the
//     exact URLs those pages canonicalize to), plus
//   per zone that resolves (has a polygon_boundary):
//     /{zone}                       zone home
//     /{zone}/products              zone listing
//     /{zone}/product/{slug}        every product LISTED IN THAT ZONE
//
// Product listing is per-store, so each zone's catalogue genuinely differs —
// this is not the same URL repeated per zone.

const BASE = process.env.NEXT_PUBLIC_BASE_URL;
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 h — zone catalogues change slowly
const MAX_PRODUCTS_PER_ZONE = 500;

// Un-prefixed routes worth indexing. Mirrors what scripts/generator.js emitted,
// minus the funnel/error pages it excluded (cart, checkout, 404, payment).
// Zone-prefixed equivalents are generated below; these stay for visitors who
// arrive without a zone.
const STATIC_ROUTES = [
  ["", "1.0", "daily"],
  ["/products", "0.9", "daily"],
  ["/categories", "0.8", "weekly"],
  ["/brands", "0.7", "weekly"],
  ["/sellers", "0.7", "weekly"],
  ["/countries", "0.6", "weekly"],
  ["/blogs", "0.6", "weekly"],
  ["/about-us", "0.5", "monthly"],
  ["/contact-us", "0.5", "monthly"],
  ["/faqs", "0.5", "monthly"],
  ["/privacy-policy", "0.3", "yearly"],
  ["/terms-and-conditions", "0.3", "yearly"],
  ["/shipping-policy", "0.3", "yearly"],
  ["/cancellation-policy", "0.3", "yearly"],
  ["/return-and-exchange-policy", "0.3", "yearly"],
];

const ACCESS_KEY = "903361";
const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}${process.env.NEXT_PUBLIC_API_SUBURL}`;
const SLUG_PAGE_LIMIT = 200;
const MAX_SLUG_PAGES = 50; // hard backstop against a runaway paginator

let __cache = null;
let __cachedAt = 0;

const urlEntry = (loc, { changefreq = "daily", priority = "0.7" } = {}) =>
  `  <url>
    <loc>${loc}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;

// Pull every page of data[].slug from a paginated GET endpoint. Blog & category
// detail pages are zone-independent (their canonical is un-zoned), so they must
// be listed un-prefixed here — the old scripts/generator.js emitted them and the
// zone-only sitemap had dropped them, making articles/categories undiscoverable.
const fetchSlugs = async (endpoint) => {
  const slugs = [];
  try {
    for (let offset = 0; offset < MAX_SLUG_PAGES * SLUG_PAGE_LIMIT; offset += SLUG_PAGE_LIMIT) {
      const res = await axios.get(`${API_BASE}/${endpoint}`, {
        params: { limit: SLUG_PAGE_LIMIT, offset },
        headers: { "x-access-key": ACCESS_KEY },
      });
      const rows = res.data?.data || [];
      for (const r of rows) if (r?.slug) slugs.push(r.slug);
      if (rows.length < SLUG_PAGE_LIMIT) break; // short page = last page
    }
  } catch (err) {
    console.warn(`[sitemap] ${endpoint} slugs failed:`, err?.message);
  }
  return slugs;
};

const buildSitemap = async () => {
  const zones = await getZonesCached();
  const entries = STATIC_ROUTES.map(([path, priority, changefreq]) =>
    urlEntry(`${BASE}${path || "/"}`, { priority, changefreq }),
  );

  // Un-zoned blog + category detail URLs (zone-independent content; these are the
  // exact URLs those pages canonicalize to). Fetched in parallel.
  const [blogSlugs, categorySlugs] = await Promise.all([
    fetchSlugs(apiEndPoints.blogs),
    fetchSlugs(apiEndPoints.getCategory),
  ]);
  for (const slug of blogSlugs) {
    entries.push(
      urlEntry(`${BASE}/blog/${slug}`, { changefreq: "weekly", priority: "0.6" }),
    );
  }
  for (const slug of categorySlugs) {
    entries.push(
      urlEntry(`${BASE}/categories/${slug}`, {
        changefreq: "weekly",
        priority: "0.7",
      }),
    );
  }

  for (const zone of zones) {
    // No boundary -> no centroid -> the route 404s. Never list a URL that 404s;
    // it burns crawl budget and signals a broken site. Same helper the resolver
    // uses, so the sitemap and the routes agree on which zones exist.
    const center = getPolygonCenter(zone?.polygon_boundary);
    if (!center || !zone?.slug) continue;

    entries.push(
      urlEntry(`${BASE}/${zone.slug}`, { changefreq: "daily", priority: "0.9" }),
    );
    entries.push(
      urlEntry(`${BASE}/${zone.slug}/products`, {
        changefreq: "daily",
        priority: "0.8",
      }),
    );

    // That zone's own catalogue, fetched with the zone's channel.
    const products = await getProductsServer({
      latitude: center.lat,
      longitude: center.lng,
      // "both" zones would be rejected by the products endpoint, listing zero
      // products for them — normalize to a header value the API accepts.
      channel: requestChannel(zone.channel),
      limit: MAX_PRODUCTS_PER_ZONE,
    }).catch((err) => {
      console.warn(`[sitemap] ${zone.slug} products failed:`, err?.message);
      return [];
    });

    for (const p of products) {
      if (!p?.slug) continue;
      entries.push(
        urlEntry(`${BASE}/${zone.slug}/product/${p.slug}`, {
          changefreq: "weekly",
          priority: "0.7",
        }),
      );
    }
    // A zone hitting the cap is silently under-listed otherwise.
    if (products.length >= MAX_PRODUCTS_PER_ZONE) {
      console.warn(
        `[sitemap] ${zone.slug} hit the ${MAX_PRODUCTS_PER_ZONE} cap — some products omitted`,
      );
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join("\n")}
</urlset>`;
};

export const getServerSideProps = async ({ res }) => {
  const now = Date.now();
  if (!__cache || now - __cachedAt > CACHE_TTL_MS) {
    __cache = await buildSitemap();
    __cachedAt = now;
  }

  res.setHeader("Content-Type", "text/xml");
  res.setHeader(
    "Cache-Control",
    "public, s-maxage=3600, stale-while-revalidate=86400",
  );
  res.write(__cache);
  res.end();
  return { props: {} };
};

// Never rendered — getServerSideProps writes the response directly.
export default function Sitemap() {
  return null;
}
