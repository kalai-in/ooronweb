import { NextResponse } from "next/server";
import axios from "axios";
import { getZonesCached, requestChannel } from "@/api/zoneResolver";
import { getProductsServer } from "@/api/serverApi";
import { getLanguagesCached } from "@/api/languageResolver";
import { getPolygonCenter } from "@/utils/helperFunction";
import { canonicalUrl } from "@/utils/canonicalUrl";
import * as apiEndPoints from "@/api/apiEndpoints";

// Zone-aware, LANGUAGE-aware sitemap, generated per request (cached below).
//
// Replaces scripts/generator.js's static public/sitemap.xml for zone URLs: that
// script only runs under `npm run export`, never `npm run build`, so its output
// is a stale committed file with no zone URLs in it.
//
// Two distinct route shapes (see zonePrefixable.ts / RESERVED_ROUTES) — never
// cross the two:
//   GLOBAL_LANG_ROUTES  — language-only (about-us, privacy-policy, ...). One
//     entry per supported language, via canonicalUrl(zone: null). MUST NOT
//     get a zone segment — these pages read identically in every zone.
//   zone loop           — language x zone, per zone that resolves (has a
//     polygon_boundary):
//       /{zone}                       zone home
//       /{zone}/products              zone listing
//       /{zone}/product/{slug}        every product LISTED IN THAT ZONE
//     each also emitted once per language via canonicalUrl(zone: zone.slug).
//
// Product listing is per-store, so each zone's catalogue genuinely differs —
// this is not the same URL repeated per zone.
//
// brands/sellers/countries are intentionally left as single un-prefixed
// entries: their page components ignore the [lang] param entirely (no
// translated content, no canonical/hreflang of their own — see
// brands/page.tsx) — enumerating fake language variants for them would add
// near-duplicate URLs, not real coverage.

export const dynamic = "force-dynamic";

const BASE = process.env.NEXT_PUBLIC_BASE_URL;
const CACHE_TTL_MS = 1000 * 60 * 60; // 1 h — zone catalogues change slowly
const MAX_PRODUCTS_PER_ZONE = 500;

// GLOBAL pages: language-only, never zone-prefixed. Path matches each route's
// own PATH constant in its page.tsx (see e.g. privacy-policy/page.tsx) so the
// sitemap and the page's own canonical never disagree.
const GLOBAL_LANG_ROUTES: [string, string, string][] = [
  ["/", "1.0", "daily"],
  ["/categories", "0.8", "weekly"],
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

// Un-prefixed, un-localized routes — no [lang]-aware content, listed once.
// NOTE: no unprefixed "/products" here — there is no zone-less /products
// route (see products/page.tsx's own comment); every products listing is
// zone-mandatory and is emitted per zone below instead.
const STATIC_ROUTES: [string, string, string][] = [
  ["/brands", "0.7", "weekly"],
  ["/sellers", "0.7", "weekly"],
  ["/countries", "0.6", "weekly"],
];

const ACCESS_KEY = "903361";
const API_BASE = `${process.env.NEXT_PUBLIC_API_URL}${process.env.NEXT_PUBLIC_API_SUBURL}`;
const SLUG_PAGE_LIMIT = 200;
const MAX_SLUG_PAGES = 50; // hard backstop against a runaway paginator

let __cache: string | null = null;
let __cachedAt = 0;

const urlEntry = (
  loc: string,
  { changefreq = "daily", priority = "0.7" }: { changefreq?: string; priority?: string } = {},
) =>
  `  <url>
    <loc>${loc}</loc>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;

// Pull every page of data[].slug from a paginated GET endpoint. Blog & category
// detail pages are zone-independent (their canonical is un-zoned), so they must
// be listed un-prefixed here — the old scripts/generator.js emitted them and the
// zone-only sitemap had dropped them, making articles/categories undiscoverable.
const fetchSlugs = async (endpoint: string): Promise<string[]> => {
  const slugs: string[] = [];
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
  } catch (err: any) {
    console.warn(`[sitemap] ${endpoint} slugs failed:`, err?.message);
  }
  return slugs;
};

// De-dupes as a side effect of using a Map keyed on the final URL — two
// languages that both resolve to the SAME href (e.g. default language always
// omits its prefix, so an explicit `defaultCode` pass and an accidental
// re-pass would otherwise collide) must not produce two <url> entries.
const addEntry = (
  seen: Map<string, string>,
  loc: string,
  opts: { priority?: string; changefreq?: string },
) => {
  if (seen.has(loc)) return;
  seen.set(loc, urlEntry(loc, opts));
};

const buildSitemap = async (): Promise<string> => {
  const [zones, { codes, defaultCode }] = await Promise.all([
    getZonesCached(),
    getLanguagesCached(),
  ]);
  const languages = [...codes];
  const seen = new Map<string, string>();

  // Un-prefixed, un-localized routes — listed once, no language enumeration.
  for (const [path, priority, changefreq] of STATIC_ROUTES) {
    addEntry(seen, `${BASE}${path}`, { priority, changefreq });
  }

  // GLOBAL pages: one entry per supported language, canonicalUrl(zone: null)
  // — reuses the exact helper each page's own generateMetadata uses, so the
  // sitemap can never list a URL that disagrees with that page's canonical.
  for (const [path, priority, changefreq] of GLOBAL_LANG_ROUTES) {
    for (const lang of languages) {
      const loc = canonicalUrl({ lang, zone: null, path, defaultCode });
      addEntry(seen, loc, { priority, changefreq });
    }
  }

  // Un-zoned blog + category detail URLs (zone-independent content), one per
  // language — these are LANGUAGE-aware routes (see blog/[slug]/page.tsx,
  // categories/[slug]/page.tsx), just never zone-prefixed. Fetched in parallel.
  const [blogSlugs, categorySlugs] = await Promise.all([
    fetchSlugs(apiEndPoints.blogs),
    fetchSlugs(apiEndPoints.getCategory),
  ]);
  for (const slug of blogSlugs) {
    for (const lang of languages) {
      const loc = canonicalUrl({ lang, zone: null, path: `/blog/${slug}`, defaultCode });
      addEntry(seen, loc, { changefreq: "weekly", priority: "0.6" });
    }
  }
  for (const slug of categorySlugs) {
    for (const lang of languages) {
      const loc = canonicalUrl({
        lang,
        zone: null,
        path: `/categories/${slug}`,
        defaultCode,
      });
      addEntry(seen, loc, { changefreq: "weekly", priority: "0.7" });
    }
  }

  for (const zone of zones as any[]) {
    // No boundary -> no centroid -> the route 404s. Never list a URL that 404s;
    // it burns crawl budget and signals a broken site. Same helper the resolver
    // uses, so the sitemap and the routes agree on which zones exist.
    const center = getPolygonCenter(zone?.polygon_boundary);
    if (!center || !zone?.slug) continue;

    // Zone routes: language x zone, via the same canonicalUrl helper the
    // zone pages' own generateMetadata uses.
    for (const lang of languages) {
      addEntry(
        seen,
        canonicalUrl({ lang, zone: zone.slug, path: "/", defaultCode }),
        { changefreq: "daily", priority: "0.9" },
      );
      addEntry(
        seen,
        canonicalUrl({ lang, zone: zone.slug, path: "/products", defaultCode }),
        { changefreq: "daily", priority: "0.8" },
      );
    }

    // That zone's own catalogue, fetched with the zone's channel.
    const products: any[] = await getProductsServer({
      latitude: center.lat,
      longitude: center.lng,
      // "both" zones would be rejected by the products endpoint, listing zero
      // products for them — normalize to a header value the API accepts.
      channel: requestChannel(zone.channel),
      // Not passed by the original sitemap generator either — preserved as-is.
      lang: undefined,
      limit: MAX_PRODUCTS_PER_ZONE,
    }).catch((err: any) => {
      console.warn(`[sitemap] ${zone.slug} products failed:`, err?.message);
      return [];
    });

    for (const p of products) {
      if (!p?.slug) continue;
      for (const lang of languages) {
        addEntry(
          seen,
          canonicalUrl({
            lang,
            zone: zone.slug,
            path: `/product/${p.slug}`,
            defaultCode,
          }),
          { changefreq: "weekly", priority: "0.7" },
        );
      }
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
${[...seen.values()].join("\n")}
</urlset>`;
};

export async function GET() {
  const now = Date.now();
  if (!__cache || now - __cachedAt > CACHE_TTL_MS) {
    __cache = await buildSitemap();
    __cachedAt = now;
  }

  return new NextResponse(__cache, {
    headers: {
      "Content-Type": "text/xml",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
