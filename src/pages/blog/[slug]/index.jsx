import React from "react";
import dynamic from "next/dynamic";
const BlogDetailPage = dynamic(
  () => import("@/components/pagecomponents/BlogDetailPage"),
  { ssr: false }
);

import MetaData from "@/components/metadata-component/MetaData";
import axios from "axios";
import { extractJSONFromMarkup } from "@/utils/helperFunction";
import { canonicalUrl, hreflangAlternates } from "@/utils/canonicalUrl";
import { getLanguagesCached } from "@/api/languageResolver";
import Custom404 from "@/pages/404";

let serverSidePropsFunction = null;

if (process.env.NEXT_PUBLIC_SEO == "true") {
  serverSidePropsFunction = async (context) => {
    const { slug } = context.params;
    const lang = context.query.lang;
    // Language code list + default both from the API (never hardcoded) so an
    // admin-added language shows up in hreflang without a redeploy.
    const { codes, defaultCode: langDefault } = await getLanguagesCached();
    const langCodes = [...codes];

    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}${process.env.NEXT_PUBLIC_API_SUBURL}/blogs`,
        {
          params: {
            slug: slug,
          },
          headers: {
            "Content-Language": lang,
          }
        }
      );

      // A missing slug returns HTTP 200 with an empty data array, not an error —
      // so we must 404 explicitly here. Without this the page returns 200 with
      // fallback meta AND a canonical/hreflang pointing at a URL that has no
      // article: a soft-404 that Google indexes as a real page. Return
      // notFound so the server sends a true 404 and emits no canonical.
      // Render Custom404 in-page (not notFound): this route is reachable via a
      // middleware REWRITE (/{lang}/blog/{slug}), and a rewritten route returning
      // notFound makes Next serve its built-in _error page instead of the custom
      // 404.js. In-page render with a 404 status shows the custom design for both
      // the direct and language-rewritten URLs.
      const blog = response?.data?.data?.[0];
      if (!blog) {
        if (context.res) context.res.statusCode = 404;
        return { props: { notFoundPage: true } };
      }

      let metaTitle = process.env.NEXT_PUBLIC_META_TITLE;
      let metaDescription = process.env.NEXT_PUBLIC_META_DESCRIPTION;
      let markUpSchema = "";
      let metaKeywords = process.env.NEXT_PUBLIC_META_KEYWORDS;
      let og_image = null;
      let favicon = null;
      if (process.env.NEXT_PUBLIC_SEO === "true") {
        // API returns meta fields at root; translated blogs also carry a
        // `translations` object with per-language overrides. Prefer the
        // translation, fall back to the root value, then the env default.
        metaKeywords =
          blog?.translations?.meta_keywords || blog?.meta_keywords || metaKeywords;
        metaTitle =
          blog?.translations?.meta_title || blog?.meta_title || metaTitle;
        metaDescription =
          blog?.translations?.meta_description ||
          blog?.meta_description ||
          metaDescription;
        og_image = blog?.image_url || null;
        favicon = blog?.favicon || null;
        const schemaMarkupRaw =
          blog?.translations?.schema_markup || blog?.schema_markup;
        if (schemaMarkupRaw) {
          markUpSchema = extractJSONFromMarkup(schemaMarkupRaw) || "";
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
          lang: lang ?? null,
          langCodes,
          langDefault,
        },
      };
    } catch (error) {
      console.error("Error fetching product data:", error);
      if (context.res) context.res.statusCode = 404;
      return {
        props: { notFoundPage: true },
      };
    }
  };
}

export const getServerSideProps = serverSidePropsFunction;

const index = ({
  slug,
  metaKeywords,
  metaTitle,
  metaDescription,
  markUpSchema,
  og_image,
  favicon,
  lang,
  langCodes,
  langDefault,
  notFoundPage = false,
}) => {
  // Missing blog / fetch error (see gSSP) -> custom 404 UI, 404 status.
  if (notFoundPage) {
    return <Custom404 />;
  }
  // zone: null — blog URLs carry no zone at all now: links are emitted zone-less
  // and middleware 308s any legacy /{zone}/blog/x to this shape, so the canonical
  // simply matches the live URL (/ur/blog/x, /blog/x for default). hreflang ties
  // the per-language variants together as translations.
  const path = `/blog/${slug}`;
  const pageUrl = canonicalUrl({ lang, zone: null, path, defaultCode: langDefault });
  const alternates = hreflangAlternates({
    zone: null,
    path,
    codes: langCodes,
    defaultCode: langDefault,
  });
  return (
    <div>
      <MetaData
        pageName="/blog/"
        title={metaTitle}
        keywords={metaKeywords}
        description={metaDescription}
        structuredData={markUpSchema}
        ogUrl={pageUrl}
        alternates={alternates}
        ogImage={og_image}
        favicon={favicon}
      />
      <BlogDetailPage />
    </div>
  );
};

export default index;
