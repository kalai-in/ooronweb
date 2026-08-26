import React from "react";
// const SocialPages = dynamic(() => import('@/components/commonComponents/SocialPages'), { ssr: false })
import dynamic from "next/dynamic";
// SSR pilot: this page renders on the server so crawlers get real product HTML.
// Every other page is still ssr:false — do not copy this without also verifying
// the component tree survives a server render.
const ProductDescriptionPage = dynamic(
  () => import("@/components/pagecomponents/ProductDescriptionPage"),
);
import MetaData from "@/components/metadata-component/MetaData";
import axios from "axios";
import { extractJSONFromMarkup } from "@/utils/helperFunction";
import { getProductByIdServer } from "@/api/serverApi";
import { resolveZoneBySlug } from "@/api/zoneResolver";
import { canonicalUrl, hreflangAlternates } from "@/utils/canonicalUrl";
import { getLanguagesCached } from "@/api/languageResolver";
import Custom404 from "@/pages/404";

// Build a schema.org Product + Offer JSON-LD from the SSR product payload so the
// price, currency and availability appear in structured data (Google rich
// results / Merchant). The API's schema_markup field is admin-authored free text
// that rarely carries a live price; this is generated from the real product so
// the price is always correct. Only used when the admin set NO schema_markup —
// an explicit admin schema always wins. Returns a JSON string (MetaData injects
// via dangerouslySetInnerHTML) or null when there isn't enough data.
const buildProductSchema = ({ productRes, slug, pageUrl }) => {
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
    (typeof p?.images?.[0] === "string"
      ? p.images[0]
      : p?.images?.[0]?.image_url) ||
    undefined;

  // In stock when any variant has stock or is flagged unlimited.
  const inStock = Array.isArray(p?.variants)
    ? p.variants.some(
        (v) => Number(v?.stock) > 0 || Number(v?.is_unlimited_stock) === 1,
      )
    : Number(p?.stock) > 0;

  const offer = {
    "@type": "Offer",
    price: price.toFixed(2),
    availability: inStock
      ? "https://schema.org/InStock"
      : "https://schema.org/OutOfStock",
    url: pageUrl,
  };
  if (currency) offer.priceCurrency = currency;

  const schema = {
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

let serverSidePropsFunction = null;

if (process.env.NEXT_PUBLIC_SEO == "true") {
  serverSidePropsFunction = async (context) => {
    const { slug } = context.params;
    const lang = context.query.lang;
    // langCodes/langDefault are read by the catch block below too, so they must
    // be assigned (even on failure) before anything that can throw runs — a
    // rejected getLanguagesCached() here used to escape uncaught and 500 the
    // page instead of falling back to the safe error props.
    let langCodes = ["en"];
    let langDefault = "en";
    let isMetadata = false;
    try {
      // Language codes for hreflang — from the API, never hardcoded, so a
      // language added by an admin shows up in alternates without a redeploy.
      // Code list AND default both from the API — admin can change the default.
      const langs = await getLanguagesCached();
      langCodes = [...langs.codes];
      langDefault = langs.defaultCode;

      // get_seo and the zone lookup are independent — neither reads the other's
      // result — so they run concurrently. Serially they cost the SUM of two
      // round-trips to the API host on every request, and a product grid fires
      // one of these per card.
      const zoneSlug = context.query.zone;
      const seoPromise = axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}${process.env.NEXT_PUBLIC_API_SUBURL}/products/get_seo`,
        {
          params: {
            slug: slug,
          },
          headers: {
            "Content-Language": lang,
          },
        },
      );

      // The product fetch needs the zone's coordinates, so it can't start until
      // the zone resolves — but it does NOT need get_seo. Chaining it onto the
      // zone promise instead of awaiting the whole Promise.all first means the
      // product request goes out the moment the zone lands, overlapping with
      // get_seo rather than queueing behind it. Saves one full round-trip to the
      // API host on every product page.
      const productPromise = (
        zoneSlug ? resolveZoneBySlug(zoneSlug) : Promise.resolve(null)
      ).then(async (zone) => {
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
        } catch (err) {
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
      if (
        response.data.data?.meta_title &&
        response.data.data?.meta_description &&
        response.data.data?.meta_keywords
      ) {
        isMetadata = true;
      }
      let metatitle = process.env.NEXT_PUBLIC_META_TITLE;
      let metaDescription = process.env.NEXT_PUBLIC_META_DESCRIPTION;
      let metaKeywords = process.env.NEXT_PUBLIC_META_KEYWORDS;
      let schemaMarkup = null;
      let og_image = null;
      let favicon = null;
      if (process.env.NEXT_PUBLIC_SEO == "true" && isMetadata == true) {
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
      // SSR pilot: resolve coordinates from a zone slug, then fetch the product
      // server-side so the HTML carries real content. The client normally reads
      // coords from a localStorage-persisted city, which the server can't see.
      //
      // TEMPORARY WIRING: the zone arrives as ?zone=<slug> until /[zone]/ routes
      // and middleware land, at which point this reads context.params.zone.
      // The zone is OPTIONAL and additive. With it we can server-render the
      // product; without it we render exactly as before and the client fetches
      // on mount using its localStorage city. A missing/unknown zone must never
      // 404 a product that exists — normal visitors browse without one.
      // (zoneSlug/resolved are resolved above, in parallel with get_seo.)

      // A zone-prefixed URL naming a zone that doesn't resolve is a dead URL —
      // 404 it. (Middleware only shape-checks the segment; this is the real
      // check.) A request with no zone at all is the legacy route and must
      // still render — see the comment above.
      // Reached via a middleware REWRITE (/{zone}/product/{slug}). A rewritten
      // route returning notFound makes Next serve its built-in _error page
      // instead of custom 404.js — render Custom404 in-page with a 404 status.
      if (zoneSlug && !resolved) {
        if (context.res) context.res.statusCode = 404;
        return { props: { notFoundPage: true } };
      }

      // (The zone's own channel and the product fetch are resolved together in
      // the Promise.all above — the zone slug in the URL already determines
      // which catalogue to serve, bhuj-quick -> quick, bhuj-ecommerce ->
      // ecommerce. One call, no guessing.)

      // Auto-generate Product+Offer structured data from the SSR product when the
      // admin set no schema_markup, so the price shows up in JSON-LD. An explicit
      // admin schema is left untouched (it wins).
      if (!schemaMarkup && initialProduct) {
        try {
          const offerUrl = canonicalUrl({
            lang,
            zone: resolved?.zone?.slug ?? null,
            path: `/product/${slug}`,
            defaultCode: langDefault,
          });
          const productSchema = buildProductSchema({
            productRes: initialProduct,
            slug,
            pageUrl: offerUrl,
          });
          if (productSchema) schemaMarkup = productSchema;
        } catch (err) {
          console.log("SSR product schema build failed:", err?.message);
        }
      }

      return {
        props: {
          slug: slug,
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
          zone: resolved?.zone?.slug ?? null,
          lang: lang ?? null,
          langCodes,
          langDefault,
        },
      };
    } catch (error) {
      console.log("error", error);
      // SEO metadata is optional. A failed get_seo_things fetch must NOT 404 a
      // product that exists — returning undefined here makes Next render /404.
      // Fall back to env defaults so the page renders; the client fetches the
      // product by slug and shows its own not-found state if truly missing.
      return {
        props: {
          slug: context.params.slug,
          title: process.env.NEXT_PUBLIC_META_TITLE ?? null,
          description: process.env.NEXT_PUBLIC_META_DESCRIPTION ?? null,
          keywords: process.env.NEXT_PUBLIC_META_KEYWORDS ?? null,
          og_image: null,
          schemaMarkup: null,
          favicon: null,
          initialProduct: null,
          // Unvalidated here by design: this path runs when the SEO fetch threw,
          // so the resolver may not have run. Echoing the requested zone keeps
          // the canonical self-consistent instead of silently dropping to the
          // legacy URL.
          zone: context.query.zone ?? null,
          lang: context.query.lang ?? null,
          langCodes,
          langDefault,
        },
      };
    }
  };
}

export const getServerSideProps = serverSidePropsFunction;

export default function Index({
  slug,
  title,
  description,
  keywords,
  og_image,
  schemaMarkup,
  favicon,
  initialProduct,
  zone,
  lang,
  langCodes,
  langDefault,
  notFoundPage = false,
}) {
  // Unresolvable zone (see gSSP) -> custom 404 UI, served with a 404 status.
  if (notFoundPage) {
    return <Custom404 />;
  }
  // Each URL is canonical to itself, across BOTH axes: /ur/bhuj/product/x
  // canonicals to /ur/bhuj/product/x, /bhuj/product/x to itself, /product/x to
  // itself. Cross-linking them would tell Google the localized/zoned variants
  // aren't worth indexing — the whole point of this work. hreflang ties the
  // language variants together so they read as translations, not duplicates.
  const path = `/product/${slug}`;
  const pageUrl = canonicalUrl({ lang, zone, path, defaultCode: langDefault });
  const alternates = hreflangAlternates({
    zone,
    path,
    codes: langCodes,
    defaultCode: langDefault,
  });
  return (
    <>
      <MetaData
        pageName="/product/"
        title={title}
        description={description}
        keywords={keywords}
        structuredData={schemaMarkup}
        ogUrl={pageUrl}
        alternates={alternates}
        ogImage={og_image}
        favicon={favicon}
      />
      <ProductDescriptionPage initialProduct={initialProduct} />
    </>
  );
}
