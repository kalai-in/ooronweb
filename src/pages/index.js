import MetaData from "@/components/metadata-component/MetaData";
import { extractJSONFromMarkup } from "@/utils/helperFunction";
import axios from "axios";
import dynamic from "next/dynamic";
import { resolveZoneBySlug, firstZoneLocation } from "@/api/zoneResolver";
import { canonicalUrl, hreflangAlternates } from "@/utils/canonicalUrl";
import { getLanguagesCached } from "@/api/languageResolver";
import { getHomeLayoutServer, getSettingServer } from "@/api/serverApi";
import { deviceFromUserAgent } from "@/utils/deviceFromUserAgent";
import { selectSeoRow, pickSeoField } from "@/utils/selectSeoRow";
import { tabIdFromSlug } from "@/utils/categoryTabSlug";
import Custom404 from "@/pages/404";

// Server-rendered when the URL resolves a zone (see getServerSideProps). Without
// ssr:false the home content ships in the HTML for crawlers; with no zone the
// tree still renders, and HomeLayout falls back to its client fetch.
//
// No `loading` fallback on purpose: this component IS server-rendered, so the
// HTML already holds the real Homepage tree. A `loading` element would render on
// the client while the lazy chunk is still in flight and hydrate against that
// server HTML — a guaranteed mismatch. `loading` is only safe with ssr:false.
const HomePage = dynamic(() =>
  import("@/components/pagecomponents/Homepage")
);

const fallbackProps = {
  props: {
    title: process.env.NEXT_PUBLIC_META_TITLE || null,
    description: process.env.NEXT_PUBLIC_META_DESCRIPTION || null,
    keywords: process.env.NEXT_PUBLIC_META_KEYWORDS || null,
    schemaMarkup: null,
    ogImage: null,
    favicon: null,
    initialHomeLayout: null,
  },
};

// Default JSON-LD for the home page when the admin has set no schema in the SEO
// settings. Home always shipping WebSite + Organization structured data lets
// Google understand the site (and enables the sitelinks search box) instead of
// leaving the page with no structured data at all. Built from env only, so it is
// identical on server and client. Returned as a string — MetaData injects it via
// dangerouslySetInnerHTML, which stringifies an object to "[object Object]".
const defaultHomeSchema = () => {
  const base = process.env.NEXT_PUBLIC_BASE_URL;
  const name =
    process.env.NEXT_PUBLIC_META_TITLE ||
    process.env.NEXT_PUBLIC_WEB_NAME ||
    null;
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

let serverSidePropsFunction = null;

if (process.env.NEXT_PUBLIC_SEO == "true") {
  serverSidePropsFunction = async (context) => {
   try {
    const lang = context.query.lang;

    // Middleware rewrites /{zone} here with ?zone=<slug>. Validate it: an
    // unresolvable zone in the URL is a dead page, so 404 rather than quietly
    // serving the default home under a zone URL. No zone at all is the plain
    // "/" route and must keep working.
    const zoneSlug = context.query.zone;
    // Resolving the zone must never crash the page: a throw here (zones API down)
    // would surface as a 500 for a zone home URL instead of a clean 404. Catch it
    // and treat an unresolved zone as not-found.
    let resolved = null;
    try {
      resolved = zoneSlug ? await resolveZoneBySlug(zoneSlug) : null;
    } catch (err) {
      console.warn("[home gSSP] zone resolve failed:", err?.message);
    }
    // Zone-shaped URL naming a zone that doesn't resolve = a dead page. We do NOT
    // use `notFound: true` here: this route is reached via a middleware REWRITE
    // (/{zone} -> /?zone=slug), and Next's Pages Router serves its built-in
    // _error page (not the custom 404.js) when a rewritten route's gSSP returns
    // notFound. Instead render THIS page in 404 mode — real 404 status + a flag
    // that makes the component render the Custom404 UI — so the custom design
    // shows regardless of the rewrite.
    if (zoneSlug && !resolved) {
      if (context.res) context.res.statusCode = 404;
      return { props: { notFoundPage: true } };
    }
    const zone = resolved?.zone?.slug ?? null;
    // hreflang language codes from the API — never hardcoded.
    // Both the code list AND which one is default come from the API — an admin
    // can change the default, and assuming "en" would emit wrong canonicals.
    const { codes: _langCodesSet, defaultCode: langDefault } =
      await getLanguagesCached();
    const langCodes = [..._langCodesSet];

    // Server-render the home content only when the URL resolved a zone, which is
    // the only truthful source of coordinates here — there is no default
    // location, and home_layout is entirely location-driven. Bare "/" (and zones
    // whose boundary yields no centroid) keep today's client-side fetch rather
    // than render some other zone's catalogue.
    // Resolve the coordinates + channel to server-render with:
    //   • a resolved zone URL → that zone's centroid + channel (the truthful
    //     source when the URL names a zone).
    //   • bare "/" with no zone → fall back to the store's default_city coords.
    //     Without SSR content here the crawler sees an empty home (0 headings,
    //     footer-only links) because the catalogue is otherwise client-fetched.
    //     default_city is exactly the coord fallback the client itself uses
    //     (HomeLayout: city → default_city → seed), so seeding from it renders
    //     the same home the visitor gets and the client reuses this response
    //     rather than refetching. Channel is "quick" — the client's default
    //     ShopMode ("quick") maps to the "quick" channel header.
    let ssrLat = resolved?.latitude ?? null;
    let ssrLng = resolved?.longitude ?? null;
    let ssrChannel = resolved?.channel ?? null;
    // The zones API's OWN value, which may be "both" — `channel` above has
    // already been narrowed to "quick"|"ecommerce" by requestChannel(), because
    // the layout endpoints reject "both" as a header. Only `rawChannel` still
    // says whether this zone serves both catalogues, which is what decides
    // below whether a ?tab= slug is worth looking for in the other channel.
    let ssrRawChannel = resolved?.rawChannel ?? null;
    // Site-wide favicon from general settings. Used as the fallback when the SEO
    // settings row carries none (or doesn't exist) — see the favicon chain below.
    // Fetched unconditionally: Layout.jsx only patches <link rel="icon"> in the
    // DOM after hydration, which crawlers never see, so the site favicon has to
    // reach the server HTML from here.
    let settingFavicon = null;
    try {
      const settingRes = await getSettingServer({ lang });
      // Settings `data` may be a plain object or a base64-encoded JSON string
      // (older API shape) — mirror the client decode in Layout.jsx so both read
      // it the same way.
      const settingData =
        typeof settingRes?.data === "string"
          ? JSON.parse(atob(settingRes.data))
          : settingRes?.data;
      settingFavicon = settingData?.favicon || null;
      // default_city only fills in the coords when no zone resolved.
      if (!resolved) {
        const dc = settingData?.default_city;
        if (dc?.latitude && dc?.longitude) {
          ssrLat = dc.latitude;
          ssrLng = dc.longitude;
          ssrChannel = "quick";
        }
      }
    } catch (err) {
      console.log("SSR settings fetch failed:", err?.message);
    }

    // Same gap as /products: default_city is optional and absent on some stores,
    // which left the bare "/" with no coordinates, so the home layout was never
    // fetched server-side and the crawler got an empty tree. A zone centroid is a
    // real serviceable location; the visitor's own city re-keys on hydration.
    if (!resolved && (!ssrLat || !ssrLng)) {
      try {
        const fallback = await firstZoneLocation();
        if (fallback) {
          ssrLat = fallback.latitude;
          ssrLng = fallback.longitude;
          ssrChannel = fallback.channel;
          // Keep the raw value in step so a ?tab= on the bare "/" can still be
          // looked up in the other channel (see the tab resolution below).
          ssrRawChannel = fallback.rawChannel ?? null;
        }
      } catch (err) {
        console.log("SSR zones fallback failed:", err?.message);
      }
    }

    // Which category tab the URL asks for (?tab=pharamacy). The tab is in the
    // URL so the server can render it: the previous behaviour kept the tab only
    // in persisted redux, which the server cannot read, so a reload always
    // server-rendered the FIRST tab and swapped to the real one after hydration.
    const tabSlugParam =
      typeof context.query.tab === "string" ? context.query.tab : null;

    let initialHomeLayout = null;
    let ssrTabId = null;
    if (ssrLat && ssrLng) {
      // Device comes from the User-Agent: the payload is device-specific
      // (images.app/tablet/web) and device is part of the client's query key, so
      // fetching the bucket the client will actually ask for is what lets it
      // reuse this response instead of refetching.
      const device = deviceFromUserAgent(context.req?.headers?.["user-agent"]);
      try {
        const homeRes = await getHomeLayoutServer({
          latitude: ssrLat,
          longitude: ssrLng,
          // No tab picked — the backend returns its first tab's layout, and
          // HomeLayout's initialData seeds on exactly this (selectedCategoryId
          // null) so the client reuses it instead of refetching.
          categoryId: null,
          device,
          lang,
          channel: ssrChannel,
        });
        // status 0 = store closed; that's a client-side state (StoreClosed), not
        // something to bake into the crawler's HTML. Only seed a live layout.
        if (homeRes?.status == 1 && homeRes?.data) {
          let data = homeRes.data;

          // The tab list only arrives WITH a layout, so the slug cannot be
          // resolved before the first call — hence resolve-then-refetch. Only a
          // slug naming a tab other than the one already returned costs a second
          // request; the bare "/" and the first tab's own slug cost nothing.
          //
          // An unknown slug resolves to null and simply keeps this first-tab
          // payload, so a renamed or hand-typed tab renders the default home
          // rather than erroring.
          let requestedId = tabIdFromSlug(data?.category_tabs, tabSlugParam);
          // Which channel this payload belongs to. The client's ShopMode maps to
          // it ("quick" | "allShop"→ecommerce), and it is part of the react-query
          // key, so the client can only reuse this response when the two agree.
          let ssrShopMode = ssrChannel === "ecommerce" ? "allShop" : "quick";

          // The tab may live in the OTHER channel. Each channel serves its own
          // tab list — quick has [All, Grocery, Beauty, Pharamacy, Kids, Summer]
          // while ecommerce has [All, Beauty, Fashion, Electronics, Mobiles, …] —
          // and a zone with `channel: "both"` resolves to the quick list here. So
          // ?tab=mobiles found nothing, the refetch below was skipped, and the
          // crawler got the DEFAULT tab's layout instead of the requested one.
          //
          // Only worth a second lookup when a slug was asked for and the zone
          // serves both channels; otherwise there is no other list to check.
          let tabChannel = ssrChannel;
          // Gate on rawChannel, NOT ssrChannel: requestChannel() has already
          // collapsed "both" to "quick" by this point, so `ssrChannel === "both"`
          // was never true and this whole lookup never ran.
          if (!requestedId && tabSlugParam && ssrRawChannel === "both") {
            const alt = "ecommerce";
            try {
              const altRes = await getHomeLayoutServer({
                latitude: ssrLat,
                longitude: ssrLng,
                categoryId: null,
                device,
                lang,
                channel: alt,
              });
              const altId = tabIdFromSlug(
                altRes?.data?.category_tabs,
                tabSlugParam,
              );
              if (altId) {
                requestedId = altId;
                tabChannel = alt;
                // Tell the client this payload is the ECOMMERCE channel's, so it
                // seeds under the matching query key instead of filing an
                // ecommerce layout under the "quick" one.
                ssrShopMode = "allShop";
                // Adopt the alt channel's payload as the baseline too, so
                // `firstTabId` below compares against the list the tab is in.
                data = altRes.data;
              }
            } catch (err) {
              console.log("SSR alt-channel tab lookup failed:", err?.message);
            }
          }

          const firstTabId = data?.category_tabs?.[0]?.id ?? null;
          if (requestedId && String(requestedId) !== String(firstTabId)) {
            try {
              const tabRes = await getHomeLayoutServer({
                latitude: ssrLat,
                longitude: ssrLng,
                categoryId: requestedId,
                device,
                lang,
                // The channel the tab was FOUND in, not the zone's default —
                // asking the quick channel for an ecommerce tab id just returns
                // the default layout again.
                channel: tabChannel,
              });
              if (tabRes?.status == 1 && tabRes?.data) {
                data = tabRes.data;
                ssrTabId = requestedId;
              }
            } catch (err) {
              // Tab fetch failed — fall back to the first tab's layout that is
              // already in hand rather than failing the page.
              console.log("SSR home_layout tab fetch failed:", err?.message);
            }
          }

          initialHomeLayout = {
            data,
            latitude: ssrLat,
            longitude: ssrLng,
            device,
            // The category_id this payload was fetched with. HomeLayout seeds
            // its query on exactly this value, so the client reuses the server's
            // response instead of refetching the tab it can already see.
            categoryId: ssrTabId,
            // The shop mode this payload belongs to. Without it the client
            // assumed "quick" and could seed an ecommerce layout under the quick
            // query key — which then made every tab click resolve slugs against
            // the wrong channel's tab list.
            shopMode: ssrShopMode,
          };
        }
      } catch (err) {
        // Never fail the page on this — the client refetches on mount.
        console.log("SSR home_layout fetch failed:", err?.message);
      }
    }

    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}${process.env.NEXT_PUBLIC_API_SUBURL}/settings/get_seo_settings`,
        {
          params: {
            page_type: "Home",
          },
          headers: {
            "Content-Language": lang,
          },
        },
      );

      let metatitle = process.env.NEXT_PUBLIC_META_TITLE || null;
      let metaDescription = process.env.NEXT_PUBLIC_META_DESCRIPTION || null;
      let metaKeywords = process.env.NEXT_PUBLIC_META_KEYWORDS || null;
      let ogImage = null;
      let schemaMarkup = null;
      let favicon = null;

      // Zone-based SEO: a zone URL (/bhuj-quick) uses ITS row (zone_id match);
      // the bare "/" — and any zone with no row of its own — falls back to the
      // is_default row (see selectSeoRow).
      const seo = selectSeoRow(response.data.data, resolved?.zone?.id ?? null);
      if (seo) {
        const pick = (key) => pickSeoField(seo, key);
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

      // Favicon chain: SEO row → site settings → /favicon.webp (MetaData's own
      // fallback). The middle step is what makes an admin-uploaded site favicon
      // reach the crawler; without it a site with no per-page SEO row always
      // served the template's placeholder file.
      if (!favicon) favicon = settingFavicon;

      return {
        props: {
          title: metatitle,
          description: metaDescription,
          keywords: metaKeywords,
          // Stringify: extractJSONFromMarkup returns a parsed object, but
          // MetaData injects structuredData via dangerouslySetInnerHTML, which
          // coerces a non-string to the literal "[object Object]" — invalid
          // JSON-LD that Google discards. Mirror the product page (stringifies).
          schemaMarkup:
            (schemaMarkup && typeof schemaMarkup !== "string"
              ? JSON.stringify(schemaMarkup)
              : schemaMarkup) || defaultHomeSchema(),
          ogImage: ogImage,
          favicon: favicon,
          zone,
          lang: lang ?? null,
          langCodes,
          langDefault,
          initialHomeLayout,
          // Echoed back only when it resolved to a real tab, so a bogus ?tab=
          // never reaches the canonical (it would advertise a URL that renders
          // the default tab — a duplicate of "/" under a different address).
          tabSlug: ssrTabId ? tabSlugParam : null,
        },
      };
    } catch (error) {
      console.log("error", error);
      // Keep zone + lang: the SEO fetch failing must not drop a valid localized
      // zone URL back to the bare-home canonical. Same for the home layout — the
      // SEO call and the content call fail independently.
      return {
        props: {
          ...fallbackProps.props,
          // SEO fetch failed → still ship the default home schema so the page is
          // never left with no structured data.
          schemaMarkup: defaultHomeSchema(),
          // The settings call is independent of the SEO call, so its favicon
          // survives this failure — don't let fallbackProps' null overwrite it.
          favicon: settingFavicon,
          zone,
          lang: lang ?? null,
          langCodes,
          langDefault,
          initialHomeLayout,
          tabSlug: ssrTabId ? tabSlugParam : null,
        },
      };
    }
   } catch (fatal) {
     // Any UNCAUGHT throw above (e.g. a zones/SEO helper failing in a way the
     // inner catches miss on some runtimes) must render the custom 404, not
     // Next's built-in _error page. Without this outer guard a throw here on a
     // zone-rewritten URL surfaces as /_error (the black default page) instead
     // of /404. Logged so the real cause is visible in the platform logs.
     console.error("[home gSSP] fatal, serving 404:", fatal?.stack || fatal?.message || fatal);
     if (context.res) context.res.statusCode = 404;
     return { props: { notFoundPage: true } };
   }
  };
}

export const getServerSideProps = serverSidePropsFunction;

export default function Home({
  title,
  description,
  keywords,
  ogImage,
  schemaMarkup,
  favicon,
  zone,
  lang,
  langCodes,
  langDefault,
  initialHomeLayout = null,
  tabSlug = null,
  notFoundPage = false,
}) {
  // Unresolvable zone (see gSSP): render the SAME custom 404 UI as 404.js. Served
  // with a 404 status set in gSSP; done here (not via notFound) to dodge the
  // rewrite + notFound -> _error framework behavior.
  if (notFoundPage) {
    return <Custom404 />;
  }
  // Each URL canonical to itself across both axes; hreflang links the language
  // variants. Same rule as the product and listing pages.
  //
  // The category tab is a third axis, and it lives in the query string rather
  // than the path (a path segment would collide with the zone matcher in
  // middleware.js, which treats an unknown first segment as a zone candidate).
  // canonicalUrl/hreflangAlternates build paths only, so the param is appended
  // here — each tab therefore canonicals to itself and is indexed as its own
  // page, exactly like a zone or language variant.
  const tabQuery = tabSlug ? `?tab=${encodeURIComponent(tabSlug)}` : "";
  const pageUrl =
    canonicalUrl({ lang, zone, path: "/", defaultCode: langDefault }) + tabQuery;
  const alternates = hreflangAlternates({ zone, path: "/", codes: langCodes, defaultCode: langDefault })
    .map((alt) => ({ ...alt, href: alt.href + tabQuery }));
  return (
    <>
      <MetaData
        title={title}
        description={description}
        keywords={keywords}
        pageName="/"
        structuredData={schemaMarkup}
        ogImage={ogImage}
        ogUrl={pageUrl}
        alternates={alternates}
        favicon={favicon}
      />
      <HomePage initialHomeLayout={initialHomeLayout} heading={title} />
    </>
  );
}
