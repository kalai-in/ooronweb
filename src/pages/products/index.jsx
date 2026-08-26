import React from "react";
// Server-rendered on purpose: the listing IS the page's content, and with
// ssr:false the crawler received an empty <main> while users saw 821 products.
//
// No `loading` fallback — this component server-renders, so the HTML already
// holds the real tree; a `loading` element would render on the client while the
// lazy chunk is in flight and hydrate against that server HTML (guaranteed
// mismatch). `loading` is only safe with ssr:false.
const ProductsPage = dynamic(() =>
  import("@/components/pagecomponents/Productspage")
);
import MetaData from "@/components/metadata-component/MetaData";
import axios from "axios";
import { extractJSONFromMarkup } from "@/utils/helperFunction";
import { selectSeoRow, pickSeoField } from "@/utils/selectSeoRow";
import dynamic from "next/dynamic";
import { resolveZoneBySlug, firstZoneLocation } from "@/api/zoneResolver";
import { canonicalUrl, hreflangAlternates } from "@/utils/canonicalUrl";
import { getLanguagesCached } from "@/api/languageResolver";
import {
  getProductListingServer,
  getSettingServer,
  getCategoriesTreeServer,
} from "@/api/serverApi";
import {
  parseFilterFromQuery,
  buildFilterApiParams,
  hasNoFilterParams,
} from "@/utils/urlProductFilters";
import { resolveSlugCsvToIdCsv } from "@/utils/categorySlugResolver";

// Must match ProductsList's `total_products_per_page`. The seeded page and the
// client's own fetches have to agree on page size or the offsets diverge.
const PRODUCTS_PER_PAGE = 12;

let serverSidePropsFunction = null;

if (process.env.NEXT_PUBLIC_SEO == "true") {
  serverSidePropsFunction = async (context) => {
    const lang = context.query.lang;

    // Middleware rewrites /{zone}/products here with ?zone=<slug>. Validate it:
    // an unresolvable zone is a dead URL, so 404 rather than quietly serving the
    // default listing under a zone URL. No zone at all is the legacy /products
    // route and must keep working.
    const zoneSlug = context.query.zone;
    const resolved = zoneSlug ? await resolveZoneBySlug(zoneSlug) : null;
    if (zoneSlug && !resolved) {
      return { notFound: true };
    }
    const zone = resolved?.zone?.slug ?? null;
    // hreflang language codes from the API — never hardcoded.
    // Code list AND default both from the API — admin can change the default.
    const { codes, defaultCode: langDefault } = await getLanguagesCached();
    const langCodes = [...codes];

    // Coordinates to server-render the listing with. The products API REQUIRES
    // them — without lat/lng it answers status 0 with no rows — so there is
    // nothing to render when the URL resolves no location.
    //
    //   • a zone URL  → that zone's centroid (the truthful source when the URL
    //     names a zone).
    //   • bare /products → the store's default_city, which is exactly the
    //     fallback the client itself uses (ProductsList: city → default_city),
    //     so the seeded page is the one the visitor would have fetched anyway.
    //
    // With neither, SSR is skipped and the client fetches on mount as it does
    // today — never invent coordinates, which would render another zone's
    // catalogue.
    let ssrLat = resolved?.latitude ?? null;
    let ssrLng = resolved?.longitude ?? null;
    let ssrChannel = resolved?.channel ?? null;
    if (!resolved) {
      try {
        const settingRes = await getSettingServer({ lang });
        // `data` may be a plain object or a base64-encoded JSON string (older
        // API shape) — mirror the client decode in Layout.jsx.
        const settingData =
          typeof settingRes?.data === "string"
            ? JSON.parse(atob(settingRes.data))
            : settingRes?.data;
        const dc = settingData?.default_city;
        if (dc?.latitude && dc?.longitude) {
          ssrLat = dc.latitude;
          ssrLng = dc.longitude;
          ssrChannel = "quick";
        }
      } catch (err) {
        console.log("[products gSSP] settings fetch failed:", err?.message);
      }

      // `default_city` is optional in the admin panel and is genuinely null on
      // some stores — which left bare /products with no coordinates at all, so
      // the listing fetch was skipped and the crawler got the empty <main> this
      // whole path exists to prevent. Fall back to the first zone that yields a
      // centroid: it is a real serviceable location for this store, and the
      // client re-keys to the visitor's own city on hydration anyway.
      if (!ssrLat || !ssrLng) {
        try {
          const fallback = await firstZoneLocation();
          if (fallback) {
            ssrLat = fallback.latitude;
            ssrLng = fallback.longitude;
            ssrChannel = fallback.channel;
          }
        } catch (err) {
          console.log("[products gSSP] zones fallback failed:", err?.message);
        }
      }
    }

    // Filters live in the URL now (see src/utils/urlProductFilters.js) — the
    // server reads the SAME query string the client will, so a filtered link's
    // first paint already shows the correct filtered results instead of
    // flashing unfiltered page 1 first. `buildFilterApiParams` is the exact
    // param-builder the client uses (ProductsList.fetchProducts), imported
    // here rather than re-derived, so server and client can't drift.
    const urlFilter = parseFilterFromQuery(context.query);
    const isUnfiltered = hasNoFilterParams(context.query);
    let initialProducts = null;
    if (ssrLat && ssrLng) {
      try {
        // urlFilter.category_id is a SLUG csv (see categorySlugResolver.js —
        // the categories API has no direct slug/id lookup, so resolving it
        // means fetching the full tree). Only done when a category filter is
        // actually present; getCategoriesTreeServer short-TTL-caches the tree
        // across requests so this isn't a full fetch on every single hit.
        let apiFilter = urlFilter;
        if (!isUnfiltered && urlFilter.category_id) {
          try {
            const tree = await getCategoriesTreeServer({
              latitude: ssrLat,
              longitude: ssrLng,
              lang,
              channel: ssrChannel,
            });
            const resolvedIds = resolveSlugCsvToIdCsv(
              tree?.data ?? [],
              urlFilter.category_id,
            );
            apiFilter = { ...urlFilter, category_id: resolvedIds };
          } catch (err) {
            // Never fail the page on this — fall through with the unresolved
            // slug (the listing API will just match nothing for it, same as
            // an unfiltered-safe degradation, not a crash).
            console.log("[products gSSP] category tree resolve failed:", err?.message);
          }
        }
        const listing = await getProductListingServer({
          latitude: ssrLat,
          longitude: ssrLng,
          channel: ssrChannel,
          lang,
          limit: PRODUCTS_PER_PAGE,
          offset: 0,
          filters: isUnfiltered
            ? undefined
            : buildFilterApiParams(apiFilter),
        });
        // status 0 = store closed / no serviceable catalogue here. That is a
        // client-side state, not something to bake into the crawler's HTML.
        if (listing?.status == 1) {
          initialProducts = {
            envelope: listing,
            latitude: ssrLat,
            longitude: ssrLng,
            // The exact PARSED filter this seed answers (not the raw query —
            // key order/typing can differ between context.query and
            // router.query). ProductsList only accepts this as initialData
            // when its own client-parsed filter matches, JSON-compared,
            // same reasoning as the lat/lng match check below.
            filter: urlFilter,
          };
        }
      } catch (err) {
        // Never fail the page on this — the client refetches on mount.
        console.log("[products gSSP] listing fetch failed:", err?.message);
      }
    }

    const defaultProps = {
      title: process.env.NEXT_PUBLIC_META_TITLE,
      description: process.env.NEXT_PUBLIC_META_DESCRIPTION,
      keywords: process.env.NEXT_PUBLIC_META_KEYWORDS,
      schemaMarkup: null,
      ogImage: "",
      favicon: null,
      zone,
      lang: lang ?? null,
      langCodes,
      langDefault,
      initialProducts,
    };
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}${process.env.NEXT_PUBLIC_API_SUBURL}/settings/get_seo_settings`,
        {
          params: {
            page_type: "Product listing page",
          },
          headers: {
            "Content-Language": lang,
          },
        },
      );

      let metatitle = defaultProps.title;
      let metaDescription = defaultProps.description;
      let metaKeywords = defaultProps.keywords;
      let schemaMarkup = null;
      let ogImage = defaultProps.ogImage;
      let favicon = defaultProps.favicon;

      // Zone row when the URL carries one, else the is_default row.
      const seo = selectSeoRow(response.data.data, resolved?.zone?.id ?? null);
      if (process.env.NEXT_PUBLIC_SEO == "true" && seo) {
        const pick = (key) => pickSeoField(seo, key);
        metatitle = pick("meta_title") || defaultProps.title;
        metaDescription = pick("meta_description") || defaultProps.description;
        metaKeywords = pick("meta_keyword") || defaultProps.keywords;
        ogImage = pick("og_image_url") || defaultProps.ogImage;
        favicon = pick("favicon");
        const rawSchema = pick("schema_markup");
        if (rawSchema) {
          schemaMarkup = extractJSONFromMarkup(rawSchema) || defaultProps.schemaMarkup;
        }
      }
      return {
        props: {
          title: metatitle,
          description: metaDescription,
          keywords: metaKeywords,
          schemaMarkup: schemaMarkup ? JSON.stringify(schemaMarkup) : null,
          ogImage: ogImage,
          favicon: favicon ? favicon : null,
          zone,
          lang: lang ?? null,
          langCodes,
          langDefault,
          // The SEO call and the listing call fail independently — a broken SEO
          // row must not cost the page its server-rendered products.
          initialProducts,
        },
      };
    } catch (error) {
      console.log("error", error);
      // defaultProps already carries `zone` — the SEO fetch failing must not
      // drop a valid zone URL back to the bare-listing canonical.
      return { props: defaultProps };
    }
  }
}

export const getServerSideProps = serverSidePropsFunction



const Products = ({ title, description, keywords, schemaMarkup, ogImage, favicon, zone, lang, langCodes, langDefault, initialProducts = null }) => {
  // Each URL canonical to itself across both axes; hreflang ties the language
  // variants together. Same rule as home and the product page.
  const pageUrl = canonicalUrl({ lang, zone, path: "/products", defaultCode: langDefault });
  const alternates = hreflangAlternates({ zone, path: "/products", codes: langCodes, defaultCode: langDefault });

  return (
    <>
      <MetaData
        pageName="/products"
        title={title}
        description={description}
        keywords={keywords}
        structuredData={schemaMarkup}
        ogImage={ogImage}
        ogUrl={pageUrl}
        alternates={alternates}
        favicon={favicon}
      />
      <ProductsPage initialProducts={initialProducts} />
    </>
  );
};

export default Products;
