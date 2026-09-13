import type { Metadata } from "next";
import { cache } from "react";
import axios from "axios";
import { notFound } from "next/navigation";
import ProductDescriptionPage from "@/components/pagecomponents/ProductDescriptionPage";
import LanguageCodesSeed from "@/app/LanguageCodesSeed";
import { extractJSONFromMarkup } from "@/utils/helperFunction";
import { getProductByIdServer } from "@/api/serverApi";
import { resolveZoneBySlug } from "@/api/zoneResolver";
import { canonicalUrl, hreflangAlternates } from "@/utils/canonicalUrl";
import { getLanguagesCached } from "@/api/languageResolver";
import { buildPageMetadata } from "@/utils/buildMetadata";

// Product detail is zone-mandatory — this route only ever matches
// /{lang}/{zone}/product/{slug}, so `zone` is always a real, required URL
// segment. There is no zone-less /product/{slug} route (removed).

// Build a schema.org Product + Offer JSON-LD from the SSR product payload so the
// price, currency and availability appear in structured data (Google rich
// results / Merchant). The API's schema_markup field is admin-authored free text
// that rarely carries a live price; this is generated from the real product so
// the price is always correct. Only used when the admin set NO schema_markup —
// an explicit admin schema always wins. Returns a JSON string or null when
// there isn't enough data.
const buildProductSchema = ({
  productRes,
  slug,
  pageUrl,
}: {
  productRes: any;
  slug: string;
  pageUrl: string;
}) => {
  const p = productRes?.data?.[0] || productRes?.data;
  if (!p) return null;

  // Price: prefer the first variant's discounted price, then its price, then the
  // product-level min_price. discounted_price is 0 when there's no discount.
  const variant = Array.isArray(p?.variants) ? p.variants[0] : null;
  const rawPrice =
    (variant?.discounted_price && Number(variant.discounted_price) > 0
      ? variant.discounted_price
      : variant?.price) ??
    p?.min_price ??
    p?.price;
  const price = Number(rawPrice);
  if (!price || Number.isNaN(price)) return null;

  // priceCurrency must be an ISO 4217 code — the product's `currency` field is
  // the display SYMBOL ("₹"), which Google rejects, so read `currency_code`
  // ("INR"). Some countries in this API have a malformed code ("971", "NZ$"),
  // so shape-check it: a bad code invalidates the whole Offer, and an Offer with
  // no currency at all is still valid.
  const rawCurrency = p?.currency_code || productRes?.currency_code;
  const currency = /^[A-Z]{3}$/.test(String(rawCurrency || "").toUpperCase())
    ? String(rawCurrency).toUpperCase()
    : undefined;
  const image =
    p?.image_url ||
    (typeof p?.images?.[0] === "string" ? p.images[0] : p?.images?.[0]?.image_url) ||
    undefined;

  // In stock when any variant has stock or is flagged unlimited.
  const inStock = Array.isArray(p?.variants)
    ? p.variants.some((v: any) => Number(v?.stock) > 0 || Number(v?.is_unlimited_stock) === 1)
    : Number(p?.stock) > 0;

  const offer: any = {
    "@type": "Offer",
    price: price.toFixed(2),
    availability: inStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    url: pageUrl,
  };
  if (currency) offer.priceCurrency = currency;

  const schema: any = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p?.name || p?.title || slug,
    offers: offer,
  };
  if (image) schema.image = image;
  if (p?.short_description || p?.description) {
    schema.description = String(p.short_description || p.description)
      .replace(/<[^>]*>/g, "")
      .trim()
      .slice(0, 500);
  }
  const rating = Number(p?.average_rating ?? p?.rating);
  const ratingCount = Number(p?.total_reviews ?? p?.rating_count);
  if (rating > 0 && ratingCount > 0) {
    schema.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: rating.toFixed(1),
      reviewCount: ratingCount,
    };
  }
  return JSON.stringify(schema);
};

type Params = Promise<{ lang: string; zone: string; slug: string }>;

type ProductPageData = {
  notFoundPage: boolean;
  slug: string;
  title?: string | null;
  description?: string | null;
  keywords?: string | null;
  og_image?: string | null;
  schemaMarkup?: string | null;
  favicon?: string | null;
  initialProduct: any;
  zone: string | null;
  lang: string | null;
  langCodes: string[];
  langDefault: string;
};

const loadProductData = cache(
  async (slug: string, lang: string, zoneSlug: string): Promise<ProductPageData> => {
    // langCodes/langDefault are read by the catch block below too, so they must
    // be assigned (even on failure) before anything that can throw runs — a
    // rejected getLanguagesCached() here used to escape uncaught and 500 the
    // page instead of falling back to the safe error props.
    let langCodes = ["en"];
    let langDefault = "en";
    try {
      // Language codes for hreflang — from the API, never hardcoded, so a
      // language added by an admin shows up in alternates without a redeploy.
      const langs = await getLanguagesCached();
      langCodes = [...langs.codes];
      langDefault = langs.defaultCode;

      // get_seo and the zone lookup are independent — neither reads the other's
      // result — so they run concurrently.
      const seoPromise = axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}${process.env.NEXT_PUBLIC_API_SUBURL}/products/get_seo`,
        {
          params: { slug },
          headers: { "Content-Language": lang },
        },
      );

      // The product fetch needs the zone's coordinates, so it can't start until
      // the zone resolves — but it does NOT need get_seo. Chaining it onto the
      // zone promise instead of awaiting the whole Promise.all first means the
      // product request goes out the moment the zone lands, overlapping with
      // get_seo rather than queueing behind it.
      const productPromise = resolveZoneBySlug(zoneSlug).then(async (zone: any) => {
        if (!zone) return { resolved: null, initialProduct: null };
        try {
          const productRes = await getProductByIdServer({
            slug,
            latitude: zone.latitude,
            longitude: zone.longitude,
            lang,
            channel: zone.channel,
          });
          const ok = productRes?.status == 1 && productRes?.data;
          return { resolved: zone, initialProduct: ok ? productRes : null };
        } catch (err: any) {
          // Never fail the page on this — the client refetches on mount.
          console.log("SSR product fetch failed:", err?.message);
          return { resolved: zone, initialProduct: null };
        }
      });

      const [response, { resolved, initialProduct }] = await Promise.all([
        seoPromise,
        productPromise,
      ]);

      // Truthiness, not `!= null`: the API returns "" for products with no SEO
      // overrides, and "" != null is true — which let empty strings overwrite
      // the env defaults and emit an empty <title>/description.
      const isMetadata =
        !!response.data.data?.meta_title &&
        !!response.data.data?.meta_description &&
        !!response.data.data?.meta_keywords;

      // Product-derived fallback for when the admin left SEO fields empty (the
      // common case — most products never get a manual SEO entry). Falling
      // back to the site-wide env title/description instead gave every such
      // product byte-identical <title>/<meta description>, which reads to
      // Google as duplicate content and is a likely cause of "crawled, not
      // indexed". The product's own name/description makes every page unique
      // even with zero admin SEO work.
      const p = initialProduct?.data?.[0] || initialProduct?.data;
      const productName: string | undefined = p?.name || p?.title;
      const productDescription: string | undefined = p?.short_description || p?.description
        ? String(p.short_description || p.description)
            .replace(/<[^>]*>/g, "")
            .trim()
            .slice(0, 160)
        : undefined;

      const productImage: string | undefined =
        p?.image_url ||
        (typeof p?.images?.[0] === "string" ? p.images[0] : p?.images?.[0]?.image_url) ||
        undefined;

      let metatitle = productName || process.env.NEXT_PUBLIC_META_TITLE;
      let metaDescription = productDescription || process.env.NEXT_PUBLIC_META_DESCRIPTION;
      let metaKeywords = process.env.NEXT_PUBLIC_META_KEYWORDS;
      let schemaMarkup: any = null;
      let og_image = productImage || null;
      let favicon = null;
      if (isMetadata) {
        const seoData = response.data.data;
        metatitle = seoData?.meta_title;
        metaDescription = seoData?.meta_description;
        metaKeywords = seoData?.meta_keywords;
        og_image = seoData?.og_image;
        favicon = seoData?.favicon;
        if (seoData?.schema_markup) {
          schemaMarkup = extractJSONFromMarkup(seoData?.schema_markup);
        }
      }

      // The [zone] segment names a real zone or the URL is dead — 404 rather
      // than quietly serving the product with no location.
      if (!resolved) {
        return {
          notFoundPage: true,
          slug,
          initialProduct: null,
          zone: null,
          lang: lang ?? null,
          langCodes,
          langDefault,
        };
      }

      // Auto-generate Product+Offer structured data from the SSR product when the
      // admin set no schema_markup, so the price shows up in JSON-LD. An explicit
      // admin schema is left untouched (it wins).
      if (!schemaMarkup && initialProduct) {
        try {
          const offerUrl = canonicalUrl({
            lang,
            zone: resolved.zone.slug,
            path: `/product/${slug}`,
            defaultCode: langDefault,
          });
          const productSchema = buildProductSchema({
            productRes: initialProduct,
            slug,
            pageUrl: offerUrl,
          });
          if (productSchema) schemaMarkup = productSchema;
        } catch (err: any) {
          console.log("SSR product schema build failed:", err?.message);
        }
      }

      return {
        notFoundPage: false,
        slug,
        title: metatitle,
        description: metaDescription,
        keywords: metaKeywords,
        og_image,
        // schemaMarkup is either the admin schema (an object from
        // extractJSONFromMarkup) or our generated Product schema (already a
        // JSON string) — stringify only the object so we never double-encode.
        schemaMarkup: schemaMarkup
          ? typeof schemaMarkup === "string"
            ? schemaMarkup
            : JSON.stringify(schemaMarkup)
          : null,
        favicon: favicon ? favicon : null,
        initialProduct,
        zone: resolved.zone.slug,
        lang: lang ?? null,
        langCodes,
        langDefault,
      };
    } catch (error) {
      console.log("error", error);
      // SEO metadata is optional. A failed get_seo fetch must NOT 404 a
      // product that exists — fall back to env defaults so the page renders;
      // the client fetches the product by slug and shows its own not-found
      // state if truly missing.
      return {
        notFoundPage: false,
        slug,
        title: process.env.NEXT_PUBLIC_META_TITLE ?? null,
        description: process.env.NEXT_PUBLIC_META_DESCRIPTION ?? null,
        keywords: process.env.NEXT_PUBLIC_META_KEYWORDS ?? null,
        og_image: null,
        schemaMarkup: null,
        favicon: null,
        initialProduct: null,
        // Unvalidated here by design: this path runs when the SEO fetch threw,
        // so the resolver may not have run. Echoing the requested zone keeps
        // the canonical self-consistent instead of silently dropping it.
        zone: zoneSlug,
        lang: lang ?? null,
        langCodes,
        langDefault,
      };
    }
  },
);

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang, zone, slug } = await params;
  const data = await loadProductData(slug, lang, zone);
  if (data.notFoundPage) return {};

  // Every URL is canonical to itself, across BOTH axes: /ur/bhuj/product/x
  // canonicals to /ur/bhuj/product/x. Cross-linking would tell Google the
  // localized/zoned variants aren't worth indexing. hreflang ties the
  // language variants together so they read as translations, not duplicates.
  const path = `/product/${slug}`;
  const pageUrl = canonicalUrl({ lang: data.lang, zone: data.zone, path, defaultCode: data.langDefault });
  const alternates = hreflangAlternates({
    zone: data.zone,
    path,
    codes: data.langCodes,
    defaultCode: data.langDefault,
  });

  return buildPageMetadata({
    title: data.title,
    description: data.description,
    keywords: data.keywords,
    pageName: "/product/",
    ogUrl: pageUrl,
    canonicalUrl: pageUrl,
    alternates,
    ogImage: data.og_image,
    favicon: data.favicon,
  });
}

export default async function ZoneProductRoute({ params }: { params: Params }) {
  const { lang, zone, slug } = await params;
  const data = await loadProductData(slug, lang, zone);

  // Unresolvable zone or missing product -> real 404 (renders not-found.tsx's
  // Custom404 UI, but at HTTP 404 so a crawler doesn't index a dead URL).
  if (data.notFoundPage) {
    notFound();
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
      <ProductDescriptionPage initialProduct={data.initialProduct} />
    </>
  );
}
