import type { Metadata } from "next";
import { cache } from "react";
import { headers } from "next/headers";
import axios from "axios";
import HomePage from "@/components/pagecomponents/Homepage";
import Custom404 from "@/components/notfound/Custom404";
import LanguageCodesSeed from "@/app/LanguageCodesSeed";
import SsrZoneProvider from "@/app/SsrZoneProvider";
import { extractJSONFromMarkup } from "@/utils/helperFunction";
import { resolveZoneBySlug, firstZoneLocation } from "@/api/zoneResolver";
import { canonicalUrl, hreflangAlternates } from "@/utils/canonicalUrl";
import { getLanguagesCached } from "@/api/languageResolver";
import { getHomeLayoutServer, getSettingServer } from "@/api/serverApi";
import { deviceFromUserAgent } from "@/utils/deviceFromUserAgent";
import { selectSeoRow, pickSeoField } from "@/utils/selectSeoRow";
import { tabIdFromSlug } from "@/utils/categoryTabSlug";
import { buildPageMetadata } from "@/utils/buildMetadata";

const fallbackProps = () => ({
  title: process.env.NEXT_PUBLIC_META_TITLE || null,
  description: process.env.NEXT_PUBLIC_META_DESCRIPTION || null,
  keywords: process.env.NEXT_PUBLIC_META_KEYWORDS || null,
  schemaMarkup: null as string | null,
  ogImage: null as string | null,
  favicon: null as string | null,
  initialHomeLayout: null as any,
});

// Default JSON-LD for the home page when the admin has set no schema in the SEO
// settings. Home always shipping WebSite + Organization structured data lets
// Google understand the site (and enables the sitelinks search box) instead of
// leaving the page with no structured data at all. Built from env only, so it is
// identical on server and client.
const defaultHomeSchema = (): string | null => {
  const base = process.env.NEXT_PUBLIC_BASE_URL;
  const name = process.env.NEXT_PUBLIC_META_TITLE || process.env.NEXT_PUBLIC_WEB_NAME || null;
  if (!base || !name) return null;
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${base}/#website`,
        url: base,
        name,
        description: process.env.NEXT_PUBLIC_META_DESCRIPTION || undefined,
      },
      {
        "@type": "Organization",
        "@id": `${base}/#organization`,
        name,
        url: base,
      },
    ],
  });
};

type HomePageData = {
  notFoundPage: boolean;
  title?: string | null;
  description?: string | null;
  keywords?: string | null;
  ogImage?: string | null;
  schemaMarkup?: string | null;
  favicon?: string | null;
  zone: string | null;
  /** Zone to build links with; may be set even when `zone` (canonical) is null. */
  linkZone?: string | null;
  lang: string | null;
  langCodes: string[];
  langDefault: string;
  initialHomeLayout: any;
  tabSlug: string | null;
};

const loadHomeData = cache(
  async (lang: string | undefined, zoneSlug: string | undefined, tabSlugParam: string | null, userAgent: string): Promise<HomePageData> => {
    try {
      // [zone] is a real route segment now (src/app/[lang]/(zoned)/[zone]/).
      // Validate it: an unresolvable zone in the URL is a dead page, so 404
      // rather than quietly serving the default home under a zone URL. No
      // zone at all is the plain "/" route and must keep working.
      // Resolving the zone must never crash the page: a throw here (zones API
      // down) would surface as a 500 for a zone home URL instead of a clean 404.
      let resolved: any = null;
      try {
        resolved = zoneSlug ? await resolveZoneBySlug(zoneSlug) : null;
      } catch (err: any) {
        console.warn("[home] zone resolve failed:", err?.message);
      }
      // Zone-shaped URL naming a zone that doesn't resolve = a dead page.
      // Render in 404 mode (inline Custom404) at HTTP 200 — an explicit,
      // previously-made trade-off (see plan history), unchanged by the
      // move to real path segments.
      if (zoneSlug && !resolved) {
        return {
          notFoundPage: true,
          zone: null,
          lang: lang ?? null,
          langCodes: ["en"],
          langDefault: "en",
          initialHomeLayout: null,
          tabSlug: null,
        };
      }
      const zone = resolved?.zone?.slug ?? null;
      // The zone slug links should be built with. Starts as the URL's own zone
      // and, for the bare "/" (zone === null), is filled in below from whatever
      // zone the SSR fallback actually located. Kept SEPARATE from `zone`,
      // which feeds the canonical: the canonical for "/" must stay zone-less
      // (see canonicalUrl call below), but its LINKS still have to point at
      // routable /{zone}/product/... URLs — there is no zone-less product
      // route, so a bare /product/x 404s for anyone (crawlers included)
      // reading the server HTML before hydration picks a zone.
      let linkZone: string | null = zone;
      // hreflang language codes from the API — never hardcoded.
      const { codes: langCodesSet, defaultCode: langDefault } = await getLanguagesCached();
      const langCodes = [...langCodesSet];

      // Resolve the coordinates + channel to server-render with:
      //   • a resolved zone URL → that zone's centroid + channel.
      //   • bare "/" with no zone → fall back to the store's default_city coords.
      // default_city is exactly the coord fallback the client itself uses
      // (HomeLayout: city → default_city → seed).
      let ssrLat = resolved?.latitude ?? null;
      let ssrLng = resolved?.longitude ?? null;
      let ssrChannel = resolved?.channel ?? null;
      // The zones API's OWN value, which may be "both" — `channel` above has
      // already been narrowed to "quick"|"ecommerce" by requestChannel().
      let ssrRawChannel = resolved?.rawChannel ?? null;
      // Site-wide favicon from general settings — the fallback when the SEO
      // settings row carries none. Fetched unconditionally: Layout.jsx only
      // patches <link rel="icon"> post-hydration, which crawlers never see.
      let settingFavicon: string | null = null;
      try {
        const settingRes: any = await getSettingServer({ lang });
        const settingData =
          typeof settingRes?.data === "string" ? JSON.parse(atob(settingRes.data)) : settingRes?.data;
        settingFavicon = settingData?.favicon || null;
        // default_city fills in the coords when no zone resolved AT ALL, or
        // when a real zone resolved but has no polygon_boundary to derive a
        // centroid from (ssrLat/ssrLng still null in that case) — a zone
        // without a boundary shouldn't render with no home content just
        // because it can't self-locate.
        if (!resolved || !ssrLat || !ssrLng) {
          const dc = settingData?.default_city;
          if (dc?.latitude && dc?.longitude) {
            ssrLat = dc.latitude;
            ssrLng = dc.longitude;
            // A boundary-less zone keeps ITS OWN channel (already resolved
            // from the zones API) rather than being forced to "quick" — only
            // the truly zone-less case defaults the channel.
            if (!resolved) ssrChannel = "quick";
          }
        }
      } catch (err: any) {
        console.log("SSR settings fetch failed:", err?.message);
      }

      // default_city is optional and absent on some stores — fall back to the
      // first zone that yields a centroid: a real serviceable location; the
      // visitor's own city re-keys on hydration. Also covers a resolved zone
      // with no polygon AND no default_city (last resort).
      if (!ssrLat || !ssrLng) {
        try {
          const fallback: any = await firstZoneLocation();
          if (fallback) {
            ssrLat = fallback.latitude;
            ssrLng = fallback.longitude;
            ssrChannel = fallback.channel;
            ssrRawChannel = fallback.rawChannel ?? null;
            if (!linkZone) linkZone = fallback.slug ?? null;
          }
        } catch (err: any) {
          console.log("SSR zones fallback failed:", err?.message);
        }
      }

      // Bare "/" that DID resolve coords (from default_city) never entered the
      // branch above, so it still has no slug to build links with. Look one up
      // the same way — firstZoneLocation() is served from the cached zones list,
      // so this is not an extra network round-trip in the common case.
      if (!linkZone) {
        try {
          const linkFallback: any = await firstZoneLocation();
          linkZone = linkFallback?.slug ?? null;
        } catch (err: any) {
          console.log("SSR link-zone fallback failed:", err?.message);
        }
      }

      let initialHomeLayout: any = null;
      let ssrTabId: any = null;
      if (ssrLat && ssrLng) {
        // Device comes from the User-Agent — seeds HomeLayout's local
        // render-time device bucket AND is sent to the API, which now returns
        // a device-specific layout.
        const device = deviceFromUserAgent(userAgent);
        try {
          const homeRes: any = await getHomeLayoutServer({
            latitude: ssrLat,
            longitude: ssrLng,
            // No tab picked — the backend returns its first tab's layout.
            categoryId: null,
            lang,
            channel: ssrChannel,
            device,
          });
          // status 0 = store closed; a client-side state, not baked into SSR.
          if (homeRes?.status == 1 && homeRes?.data) {
            let data = homeRes.data;

            // The tab list only arrives WITH a layout, so the slug cannot be
            // resolved before the first call — hence resolve-then-refetch.
            let requestedId = tabIdFromSlug(data?.category_tabs, tabSlugParam);
            // Which channel this payload belongs to — part of the react-query
            // key, so the client can only reuse this response when they agree.
            let ssrShopMode = ssrChannel === "ecommerce" ? "allShop" : "quick";

            // The tab may live in the OTHER channel — only worth a second
            // lookup when a slug was asked for and the zone serves both.
            let tabChannel = ssrChannel;
            if (!requestedId && tabSlugParam && ssrRawChannel === "both") {
              const alt = "ecommerce";
              try {
                const altRes: any = await getHomeLayoutServer({
                  latitude: ssrLat,
                  longitude: ssrLng,
                  categoryId: null,
                  lang,
                  channel: alt,
                  device,
                });
                const altId = tabIdFromSlug(altRes?.data?.category_tabs, tabSlugParam);
                if (altId) {
                  requestedId = altId;
                  tabChannel = alt;
                  ssrShopMode = "allShop";
                  data = altRes.data;
                }
              } catch (err: any) {
                console.log("SSR alt-channel tab lookup failed:", err?.message);
              }
            }

            const firstTabId = data?.category_tabs?.[0]?.id ?? null;
            if (requestedId && String(requestedId) !== String(firstTabId)) {
              try {
                const tabRes: any = await getHomeLayoutServer({
                  latitude: ssrLat,
                  longitude: ssrLng,
                  categoryId: requestedId,
                  lang,
                  // The channel the tab was FOUND in, not the zone's default.
                  channel: tabChannel,
                  device,
                });
                if (tabRes?.status == 1 && tabRes?.data) {
                  data = tabRes.data;
                  ssrTabId = requestedId;
                }
              } catch (err: any) {
                console.log("SSR home_layout tab fetch failed:", err?.message);
              }
            }

            initialHomeLayout = {
              data,
              latitude: ssrLat,
              longitude: ssrLng,
              device,
              // The category_id this payload was fetched with — HomeLayout
              // seeds its query on exactly this value.
              categoryId: ssrTabId,
              // Without this the client assumed "quick" and could seed an
              // ecommerce layout under the quick query key.
              shopMode: ssrShopMode,
            };
          }
        } catch (err: any) {
          // Never fail the page on this — the client refetches on mount.
          console.log("SSR home_layout fetch failed:", err?.message);
        }
      }

      try {
        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}${process.env.NEXT_PUBLIC_API_SUBURL}/settings/get_seo_settings`,
          {
            params: { page_type: "Home" },
            headers: { "Content-Language": lang },
          },
        );

        let metatitle = process.env.NEXT_PUBLIC_META_TITLE || null;
        let metaDescription = process.env.NEXT_PUBLIC_META_DESCRIPTION || null;
        let metaKeywords = process.env.NEXT_PUBLIC_META_KEYWORDS || null;
        let ogImage: string | null = null;
        let schemaMarkup: any = null;
        let favicon: string | null = null;

        // Zone-based SEO: a zone URL uses ITS row; the bare "/" — and any zone
        // with no row of its own — falls back to the is_default row.
        const seo = selectSeoRow(response.data.data, resolved?.zone?.id ?? null);
        if (seo) {
          const pick = (key: string) => pickSeoField(seo, key);
          metatitle = pick("meta_title") || metatitle;
          metaDescription = pick("meta_description") || metaDescription;
          metaKeywords = pick("meta_keyword") || metaKeywords;
          ogImage = pick("og_image_url") || ogImage;
          favicon = pick("favicon") || favicon;
          const rawSchema = pick("schema_markup");
          if (rawSchema) {
            schemaMarkup = extractJSONFromMarkup(rawSchema) || schemaMarkup;
          }
        }

        // Favicon chain: SEO row → site settings → /favicon.webp (buildPageMetadata's
        // own fallback). The middle step is what makes an admin-uploaded site
        // favicon reach the crawler.
        if (!favicon) favicon = settingFavicon;

        return {
          notFoundPage: false,
          title: metatitle,
          description: metaDescription,
          keywords: metaKeywords,
          schemaMarkup:
            (schemaMarkup && typeof schemaMarkup !== "string" ? JSON.stringify(schemaMarkup) : schemaMarkup) ||
            defaultHomeSchema(),
          ogImage,
          favicon,
          zone,
          linkZone,
          lang: lang ?? null,
          langCodes,
          langDefault,
          initialHomeLayout,
          // Echoed back only when it resolved to a real tab, so a bogus ?tab=
          // never reaches the canonical.
          tabSlug: ssrTabId ? tabSlugParam : null,
        };
      } catch (error) {
        console.log("error", error);
        // Keep zone + lang: the SEO fetch failing must not drop a valid
        // localized zone URL back to the bare-home canonical. Same for the
        // home layout — the SEO call and the content call fail independently.
        return {
          notFoundPage: false,
          ...fallbackProps(),
          schemaMarkup: defaultHomeSchema(),
          favicon: settingFavicon,
          zone,
          linkZone,
          lang: lang ?? null,
          langCodes,
          langDefault,
          initialHomeLayout,
          tabSlug: ssrTabId ? tabSlugParam : null,
        };
      }
    } catch (fatal: any) {
      // Any UNCAUGHT throw above must render the custom 404, not Next's
      // built-in not-found UI. Logged so the real cause is visible in the
      // platform logs.
      console.error("[home] fatal, serving 404:", fatal?.stack || fatal?.message || fatal);
      return {
        notFoundPage: true,
        zone: null,
        lang: lang ?? null,
        langCodes: ["en"],
        langDefault: "en",
        initialHomeLayout: null,
        tabSlug: null,
      };
    }
  },
);

async function loadForRequest(lang: string, zone: string | null, tabSlugParam: string | null) {
  const headersList = await headers();
  const userAgent = headersList.get("user-agent") || "";
  return loadHomeData(lang, zone ?? undefined, tabSlugParam, userAgent);
}

export async function generateHomeMetadata(lang: string, zone: string | null, tabSlugParam: string | null): Promise<Metadata> {
  const data = await loadForRequest(lang, zone, tabSlugParam);
  if (data.notFoundPage) return {};

  // Each URL canonical to itself across both axes; hreflang links the language
  // variants. The category tab is a third axis, living in the query string —
  // real [zone] segments removed the shape-collision concern that used to
  // justify this, but moving it to a path segment is a separate, larger
  // URL-design change and stays out of scope here.
  // canonicalUrl/hreflangAlternates build paths only, so the param is
  // appended here — each tab canonicals to itself and is indexed as its own
  // page, exactly like a zone or language variant.
  const tabQuery = data.tabSlug ? `?tab=${encodeURIComponent(data.tabSlug)}` : "";
  const pageUrl = canonicalUrl({ lang: data.lang, zone: data.zone, path: "/", defaultCode: data.langDefault }) + tabQuery;
  const alternates = hreflangAlternates({
    zone: data.zone,
    path: "/",
    codes: data.langCodes,
    defaultCode: data.langDefault,
  }).map((alt) => ({ ...alt, href: alt.href + tabQuery }));

  return buildPageMetadata({
    title: data.title,
    description: data.description,
    keywords: data.keywords,
    pageName: "/",
    ogImage: data.ogImage,
    ogUrl: pageUrl,
    canonicalUrl: pageUrl,
    alternates,
    favicon: data.favicon,
  });
}

export async function HomePageBody({ lang, zone, tabSlugParam }: { lang: string; zone: string | null; tabSlugParam: string | null }) {
  const data = await loadForRequest(lang, zone, tabSlugParam);

  // Unresolvable zone / fatal error: render the SAME custom 404 UI as
  // not-found.tsx. Done inline (not via notFound()) to dodge the
  // rewrite + notFound -> generic-not-found-page framework behavior.
  if (data.notFoundPage) {
    return <Custom404 />;
  }

  return (
    <>
      <LanguageCodesSeed codes={data.langCodes} />
      {data.schemaMarkup && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: data.schemaMarkup }}
        />
      )}
      {/* Zone-prefixes links in the SERVER HTML on the bare "/", where there is
          no [zone] route param and the persisted zone isn't readable yet. Without
          it every product link ships as /product/{slug}, which has no route and
          404s for crawlers. The canonical is unaffected — it still uses `zone`. */}
      <SsrZoneProvider zone={data.linkZone ?? data.zone ?? null}>
        <HomePage initialHomeLayout={data.initialHomeLayout} heading={data.title} />
      </SsrZoneProvider>
    </>
  );
}
