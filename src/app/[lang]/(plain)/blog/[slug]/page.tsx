import type { Metadata } from "next";
import { cache } from "react";
import axios from "axios";
import BlogDetailPage from "@/components/pagecomponents/BlogDetailPage";
import LanguageCodesSeed from "@/app/LanguageCodesSeed";
import Custom404 from "@/components/notfound/Custom404";
import { extractJSONFromMarkup } from "@/utils/helperFunction";
import { canonicalUrl, hreflangAlternates } from "@/utils/canonicalUrl";
import { getLanguagesCached } from "@/api/languageResolver";
import { buildPageMetadata } from "@/utils/buildMetadata";

type Params = Promise<{ lang: string; slug: string }>;

type BlogSeoResult =
  | { notFound: true }
  | {
      notFound: false;
      metaTitle: string;
      metaDescription: string;
      metaKeywords: string;
      markUpSchema: string;
      ogImage: string | null;
      favicon: string | null;
      langCodes: string[];
      langDefault: string;
    };

// Language code list + default both from the API (never hardcoded) so an
// admin-added language shows up in hreflang without a redeploy.
const loadBlogData = cache(async (slug: string, lang: string): Promise<BlogSeoResult> => {
  const { codes, defaultCode: langDefault } = await getLanguagesCached();
  const langCodes = [...codes];

  try {
    const response = await axios.get(
      `${process.env.NEXT_PUBLIC_API_URL}${process.env.NEXT_PUBLIC_API_SUBURL}/blogs`,
      {
        params: { slug },
        headers: { "Content-Language": lang },
      },
    );

    // A missing slug returns HTTP 200 with an empty data array, not an error —
    // so we must 404 explicitly here. Without this the page returns 200 with
    // fallback meta AND a canonical/hreflang pointing at a URL that has no
    // article: a soft-404 that Google indexes as a real page.
    const blog = response?.data?.data?.[0];
    if (!blog) return { notFound: true };

    // API returns meta fields at root; translated blogs also carry a
    // `translations` object with per-language overrides. Prefer the
    // translation, fall back to the root value, then the env default.
    const metaKeywords =
      blog?.translations?.meta_keywords || blog?.meta_keywords || process.env.NEXT_PUBLIC_META_KEYWORDS || "";
    const metaTitle =
      blog?.translations?.meta_title || blog?.meta_title || process.env.NEXT_PUBLIC_META_TITLE || "";
    const metaDescription =
      blog?.translations?.meta_description ||
      blog?.meta_description ||
      process.env.NEXT_PUBLIC_META_DESCRIPTION ||
      "";
    const ogImage = blog?.image_url || null;
    const favicon = blog?.favicon || null;
    const schemaMarkupRaw = blog?.translations?.schema_markup || blog?.schema_markup;
    const schemaMarkupObj = schemaMarkupRaw ? extractJSONFromMarkup(schemaMarkupRaw) : null;
    const markUpSchema = schemaMarkupObj ? JSON.stringify(schemaMarkupObj) : "";

    return {
      notFound: false,
      metaTitle,
      metaDescription,
      metaKeywords,
      markUpSchema,
      ogImage,
      favicon,
      langCodes,
      langDefault,
    };
  } catch (error) {
    console.error("Error fetching product data:", error);
    return { notFound: true };
  }
});

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  const result = await loadBlogData(slug, lang);
  if (result.notFound) return {};

  // zone: null — blog URLs carry no zone at all now: links are emitted
  // zone-less and middleware 308s any legacy /{zone}/blog/x to this shape, so
  // the canonical simply matches the live URL. hreflang ties the per-language
  // variants together as translations.
  const path = `/blog/${slug}`;
  const pageUrl = canonicalUrl({ lang, zone: null, path, defaultCode: result.langDefault });
  const alternates = hreflangAlternates({
    zone: null,
    path,
    codes: result.langCodes,
    defaultCode: result.langDefault,
  });

  return buildPageMetadata({
    title: result.metaTitle,
    description: result.metaDescription,
    keywords: result.metaKeywords,
    pageName: "/blog/",
    ogUrl: pageUrl,
    canonicalUrl: pageUrl,
    alternates,
    ogImage: result.ogImage,
    favicon: result.favicon,
  });
}

export default async function BlogDetailRoute({
  params,
}: {
  params: Params;
}) {
  const { lang, slug } = await params;
  const result = await loadBlogData(slug, lang);

  // Missing blog / fetch error -> custom 404 UI. Render Custom404 in-page
  // (not notFound()): this route is reachable via a middleware REWRITE
  // (/{lang}/blog/{slug}), and a rewritten route calling notFound() serves
  // Next's generic not-found UI instead of this custom design. Matches the
  // 200-status-with-404-content behavior this page already had under Pages
  // Router's equivalent in-page render (same trade-off, not a regression).
  if (result.notFound) {
    return <Custom404 />;
  }

  return (
    <div>
      <LanguageCodesSeed codes={result.langCodes} />
      {result.markUpSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: result.markUpSchema }}
        />
      )}
      <BlogDetailPage />
    </div>
  );
}
