import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import axios from "axios";
import Productspage from "@/components/pagecomponents/Productspage";
import LanguageCodesSeed from "@/app/LanguageCodesSeed";
import { extractJSONFromMarkup } from "@/utils/helperFunction";
import { selectSeoRow, pickSeoField } from "@/utils/selectSeoRow";
import { resolveZoneBySlug } from "@/api/zoneResolver";
import { canonicalUrl, hreflangAlternates } from "@/utils/canonicalUrl";
import { getLanguagesCached } from "@/api/languageResolver";
import {
  getProductListingServer,
  getCategoriesTreeServer,
} from "@/api/serverApi";
import {
  parseFilterFromQuery,
  buildFilterApiParams,
  hasNoFilterParams,
} from "@/utils/urlProductFilters";
import { resolveSlugCsvToIdCsv } from "@/utils/categorySlugResolver";
import { buildPageMetadata } from "@/utils/buildMetadata";

// Product listing is zone-mandatory — this route only ever matches
// /{lang}/{zone}/products, so `zone` is always a real, required URL segment.
// There is no zone-less /products route (removed).

// Must match ProductsList's `total_products_per_page`. The seeded page and the
// client's own fetches have to agree on page size or the offsets diverge.
const PRODUCTS_PER_PAGE = 12;

type Params = Promise<{ lang: string; zone: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type ProductsPageData = {
  notFoundZone: boolean;
  title?: string | null;
  description?: string | null;
  keywords?: string | null;
  schemaMarkup?: string | null;
  ogImage?: string | null;
  favicon?: string | null;
  zone: string | null;
  lang: string | null;
  langCodes: string[];
  langDefault: string;
  initialProducts: any;
};

const loadProductsData = cache(async (lang: string, zoneSlug: string, query: Record<string, any>): Promise<ProductsPageData> => {
  // The [zone] segment names a real zone or the URL is dead — 404 rather
  // than quietly serving a listing with no location.
  const resolved = await resolveZoneBySlug(zoneSlug);
  if (!resolved) {
    return {
      notFoundZone: true,
      zone: null,
      lang: lang ?? null,
      langCodes: ["en"],
      langDefault: "en",
      initialProducts: null,
    };
  }
  const zone = resolved.zone.slug;
  // hreflang language codes from the API — never hardcoded.
  const { codes, defaultCode: langDefault } = await getLanguagesCached();
  const langCodes = [...codes];

  // Coordinates to server-render the listing with. The products API REQUIRES
  // them — without lat/lng it answers status 0 with no rows. Normally the
  // zone's own polygon centroid; a zone with no polygon_boundary has none
  // (ssrLat/ssrLng stay null) and the client refetches its own location on
  // mount — never invent coordinates, which would render another zone's
  // catalogue.
  const ssrLat = resolved.latitude;
  const ssrLng = resolved.longitude;
  const ssrChannel = resolved.channel;

  // Filters live in the URL now (see src/utils/urlProductFilters.js) — the
  // server reads the SAME query string the client will, so a filtered link's
  // first paint already shows the correct filtered results.
  const urlFilter = parseFilterFromQuery(query);
  const isUnfiltered = hasNoFilterParams(query);
  let initialProducts: any = null;
  if (ssrLat && ssrLng) {
    try {
      // urlFilter.category_id is a SLUG csv (see categorySlugResolver.js — the
      // categories API has no direct slug/id lookup, so resolving it means
      // fetching the full tree). Only done when a category filter is present;
      // getCategoriesTreeServer short-TTL-caches the tree across requests.
      let apiFilter = urlFilter;
      if (!isUnfiltered && urlFilter.category_id) {
        try {
          const tree: any = await getCategoriesTreeServer({
            latitude: ssrLat,
            longitude: ssrLng,
            lang,
            channel: ssrChannel,
          });
          const resolvedIds = resolveSlugCsvToIdCsv(tree?.data ?? [], urlFilter.category_id);
          apiFilter = { ...urlFilter, category_id: resolvedIds };
        } catch (err: any) {
          // Never fail the page on this — fall through with the unresolved
          // slug (the listing API will just match nothing for it).
          console.log("[products] category tree resolve failed:", err?.message);
        }
      }
      const listing: any = await getProductListingServer({
        latitude: ssrLat,
        longitude: ssrLng,
        channel: ssrChannel,
        lang,
        limit: PRODUCTS_PER_PAGE,
        offset: 0,
        filters: isUnfiltered ? undefined : buildFilterApiParams(apiFilter),
      });
      // status 0 = store closed / no serviceable catalogue here. That is a
      // client-side state, not something to bake into the crawler's HTML.
      if (listing?.status == 1) {
        initialProducts = {
          envelope: listing,
          latitude: ssrLat,
          longitude: ssrLng,
          // The exact PARSED filter this seed answers — ProductsList only
          // accepts this as initialData when its own client-parsed filter
          // matches, JSON-compared, same reasoning as the lat/lng match check.
          filter: urlFilter,
        };
      }
    } catch (err: any) {
      // Never fail the page on this — the client refetches on mount.
      console.log("[products] listing fetch failed:", err?.message);
    }
  }

  const defaults = {
    title: process.env.NEXT_PUBLIC_META_TITLE,
    description: process.env.NEXT_PUBLIC_META_DESCRIPTION,
    keywords: process.env.NEXT_PUBLIC_META_KEYWORDS,
    schemaMarkup: null as string | null,
    ogImage: "",
    favicon: null as string | null,
  };

  try {
    const response = await axios.get(
      `${process.env.NEXT_PUBLIC_API_URL}${process.env.NEXT_PUBLIC_API_SUBURL}/settings/get_seo_settings`,
      {
        params: { page_type: "Product listing page" },
        headers: { "Content-Language": lang },
      },
    );

    let metatitle = defaults.title;
    let metaDescription = defaults.description;
    let metaKeywords = defaults.keywords;
    let schemaMarkup: any = null;
    let ogImage = defaults.ogImage;
    let favicon = defaults.favicon;

    // Zone row when the zone has its own SEO override, else the is_default row.
    const seo = selectSeoRow(response.data.data, resolved.zone.id);
    if (seo) {
      const pick = (key: string) => pickSeoField(seo, key);
      metatitle = pick("meta_title") || defaults.title;
      metaDescription = pick("meta_description") || defaults.description;
      metaKeywords = pick("meta_keyword") || defaults.keywords;
      ogImage = pick("og_image_url") || defaults.ogImage;
      favicon = pick("favicon");
      const rawSchema = pick("schema_markup");
      if (rawSchema) {
        schemaMarkup = extractJSONFromMarkup(rawSchema) || defaults.schemaMarkup;
      }
    }

    return {
      notFoundZone: false,
      title: metatitle,
      description: metaDescription,
      keywords: metaKeywords,
      schemaMarkup: schemaMarkup ? JSON.stringify(schemaMarkup) : null,
      ogImage,
      favicon: favicon ? favicon : null,
      zone,
      lang: lang ?? null,
      langCodes,
      langDefault,
      // The SEO call and the listing call fail independently — a broken SEO
      // row must not cost the page its server-rendered products.
      initialProducts,
    };
  } catch (error) {
    console.log("error", error);
    // zone/initialProducts already resolved above — the SEO fetch failing
    // must not drop a valid zone URL back to the canonical, nor cost the
    // page its server-rendered products.
    return {
      notFoundZone: false,
      ...defaults,
      zone,
      lang: lang ?? null,
      langCodes,
      langDefault,
      initialProducts,
    };
  }
});

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { lang, zone } = await params;
  const query = await searchParams;
  const data = await loadProductsData(lang, zone, query);
  if (data.notFoundZone) return {};

  // Each URL canonical to itself across both axes; hreflang ties the language
  // variants together. Same rule as home and the product page.
  const pageUrl = canonicalUrl({ lang: data.lang, zone: data.zone, path: "/products", defaultCode: data.langDefault });
  const alternates = hreflangAlternates({
    zone: data.zone,
    path: "/products",
    codes: data.langCodes,
    defaultCode: data.langDefault,
  });

  return buildPageMetadata({
    title: data.title,
    description: data.description,
    keywords: data.keywords,
    pageName: "/products",
    ogImage: data.ogImage,
    ogUrl: pageUrl,
    canonicalUrl: pageUrl,
    alternates,
    favicon: data.favicon,
  });
}

export default async function ZoneProductsRoute({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { lang, zone } = await params;
  const query = await searchParams;
  const data = await loadProductsData(lang, zone, query);
  if (data.notFoundZone) notFound();

  return (
    <>
      <LanguageCodesSeed codes={data.langCodes} />
      {data.schemaMarkup && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: data.schemaMarkup }}
        />
      )}
      <Productspage initialProducts={data.initialProducts} />
    </>
  );
}
