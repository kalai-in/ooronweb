import type { Metadata } from "next";
import { cache } from "react";
import BlogsPage from "@/components/pagecomponents/BlogsPage";
import LanguageCodesSeed from "@/app/LanguageCodesSeed";
import { fetchSeoRow } from "@/utils/fetchSeoRow";
import { buildPageMetadata } from "@/utils/buildMetadata";
import { canonicalUrl, hreflangAlternates } from "@/utils/canonicalUrl";
import { getLanguagesCached } from "@/api/languageResolver";

type Params = Promise<{ lang: string }>;

// No zone lookup: /blogs is never zone-prefixed (this route lives under
// [lang]/(plain)/, with no [zone] ancestor), so the SEO row is always the
// default one.
const loadBlogsData = cache(async (lang: string) => {
  const { codes, defaultCode: langDefault } = await getLanguagesCached();
  const seo = await fetchSeoRow("Blog Listing Page", lang);
  return { seo, langCodes: [...codes], langDefault };
});

// Zone COLLAPSED (zone: null): the listing is identical in every zone, so the
// canonical points at the zone-less language variant while the zone still
// rides the browser URL for navigation.
const PATH = "/blogs";

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { lang } = await params;
  const { seo, langCodes, langDefault } = await loadBlogsData(lang);

  const pageUrl = canonicalUrl({ lang, zone: null, path: PATH, defaultCode: langDefault });
  const alternates = hreflangAlternates({
    zone: null,
    path: PATH,
    codes: langCodes,
    defaultCode: langDefault,
  });

  return buildPageMetadata({
    title: seo.title,
    description: seo.description,
    keywords: seo.keywords,
    pageName: PATH,
    ogImage: seo.ogImage,
    ogUrl: pageUrl,
    canonicalUrl: pageUrl,
    alternates,
    favicon: seo.favicon,
  });
}

export default async function BlogsRoute({
  params,
}: {
  params: Params;
}) {
  const { lang } = await params;
  const { seo, langCodes } = await loadBlogsData(lang);

  return (
    <div>
      <LanguageCodesSeed codes={langCodes} />
      {seo.schemaMarkup && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: seo.schemaMarkup }}
        />
      )}
      {/* Single page H1 for SEO/accessibility, rendered server-side so it
          ships in the crawler HTML — the blog list itself is client-fetched.
          Visually hidden, matching the home page pattern (see Home.tsx).
          Individual blog cards use h2, not h1. */}
      {seo.title && <h1 className="sr-only">{seo.title}</h1>}
      <BlogsPage />
    </div>
  );
}
