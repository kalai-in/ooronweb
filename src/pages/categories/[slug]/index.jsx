import React from "react";
const CategoriesPages = dynamic(
  () => import("@/components/pagecomponents/CategoriesPages"),
  { ssr: false }
);
import dynamic from "next/dynamic";
import MetaData from "@/components/metadata-component/MetaData";
import axios from "axios";
import { extractJSONFromMarkup } from "@/utils/helperFunction";
import { resolveZoneBySlug } from "@/api/zoneResolver";
import { getLanguagesCached } from "@/api/languageResolver";
import { canonicalUrl, hreflangAlternates } from "@/utils/canonicalUrl";
import Custom404 from "@/pages/404";
let serverSidePropsFunction = null;
if (process.env.NEXT_PUBLIC_SEO == "true") {
  serverSidePropsFunction = async (context) => {
    const { slug } = context.params;
    const lang = context.query.lang;

    // Middleware rewrites /{zone}/categories/{slug} here. An unresolvable zone is
    // a dead URL -> 404, rather than serving the default listing under it.
    const zoneSlug = context.query.zone;
    const resolved = zoneSlug ? await resolveZoneBySlug(zoneSlug) : null;
    // Reached via a middleware REWRITE (/{zone}/categories/{slug}). A rewritten
    // route returning notFound makes Next serve its built-in _error page instead
    // of custom 404.js — so render Custom404 in-page with a 404 status instead.
    if (zoneSlug && !resolved) {
      if (context.res) context.res.statusCode = 404;
      return { props: { notFoundPage: true } };
    }
    const zone = resolved?.zone?.slug ?? null;
    // Codes AND default from the API — never hardcoded.
    const { codes, defaultCode: langDefault } = await getLanguagesCached();
    const langCodes = [...codes];
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}${process.env.NEXT_PUBLIC_API_SUBURL}/categories/get_seo`,
        {
          params: {
            slug: slug,
          },
          headers: {
            "Content-Language": lang,
          }
        }
      );
      let metaTitle = process.env.NEXT_PUBLIC_META_TITLE;
      let metaDescription = process.env.NEXT_PUBLIC_META_DESCRIPTION;
      let markUpSchema = "";
      let metaKeywords = process.env.NEXT_PUBLIC_META_KEYWORDS;
      let og_image = null;
      let favicon = null;
      if (process.env.NEXT_PUBLIC_SEO === "true") {
        const seoData = response?.data.data || {};
        metaKeywords = seoData?.translations?.meta_keywords || metaKeywords;
        metaTitle = seoData?.translations?.meta_title || metaTitle;
        metaDescription = seoData?.translations?.meta_description || metaDescription;
        og_image = seoData?.og_image || null;
        favicon = seoData.favicon || null;
        if (seoData?.translations?.schema_markup) {
          markUpSchema = extractJSONFromMarkup(seoData?.translations?.schema_markup) || "";
        }
      }
      return {
        props: {
          slug,
          metaKeywords,
          metaTitle,
          metaDescription,
          // Stringify — MetaData injects via dangerouslySetInnerHTML; a raw object
          // coerces to "[object Object]" (invalid JSON-LD Google discards).
          markUpSchema:
            markUpSchema && typeof markUpSchema !== "string"
              ? JSON.stringify(markUpSchema)
              : markUpSchema,
          og_image,
          favicon: favicon ? favicon : null,
          zone,
          lang: lang ?? null,
          langCodes,
          langDefault,
        },
      };
    } catch (error) {
      console.error("Error fetching product data:", error);
      // A failed get_seo_things fetch must NOT 404 a category that exists —
      // fall back to default meta and let the client resolve the category by slug.
      return {
        props: {
          slug,
          metaKeywords: process.env.NEXT_PUBLIC_META_KEYWORDS || null,
          metaTitle: process.env.NEXT_PUBLIC_META_TITLE || null,
          metaDescription: process.env.NEXT_PUBLIC_META_DESCRIPTION || null,
          markUpSchema: "",
          og_image: null,
          favicon: null,
          zone,
          lang: lang ?? null,
          langCodes,
          langDefault,
        },
      };
    }
  };
}

export const getServerSideProps = serverSidePropsFunction;

const Categories = ({
  slug,
  metaKeywords,
  metaTitle,
  metaDescription,
  markUpSchema,
  og_image,
  favicon,
  zone,
  lang,
  langCodes,
  langDefault,
  notFoundPage = false,
}) => {
  // Unresolvable zone (see gSSP) -> custom 404 UI, served with a 404 status.
  if (notFoundPage) {
    return <Custom404 />;
  }
  const path = `/categories/${slug}`;
  const pageUrl = canonicalUrl({ lang, zone, path, defaultCode: langDefault });
  const alternates = hreflangAlternates({
    zone,
    path,
    codes: langCodes,
    defaultCode: langDefault,
  });
  return (
    <div>
      <MetaData
        pageName="/categories/all"
        title={metaTitle}
        keywords={metaKeywords}
        description={metaDescription}
        structuredData={markUpSchema}
        ogUrl={pageUrl}
        alternates={alternates}
        ogImage={og_image}
        favicon={favicon}
      // key={`meta-${slug}`}
      />
      <CategoriesPages />
    </div>
  );
};

export default Categories;
