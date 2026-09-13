import type { Metadata } from "next";
import { cache } from "react";
import AboutUsPage from "@/components/pagecomponents/AboutUsPage";
import { fetchSeoRow } from "@/utils/fetchSeoRow";
import { buildPageMetadata } from "@/utils/buildMetadata";
import { canonicalUrl, hreflangAlternates } from "@/utils/canonicalUrl";
import { getLanguagesCached } from "@/api/languageResolver";
import LanguageCodesSeed from "@/app/LanguageCodesSeed";

type Params = Promise<{ lang: string }>;

// This route is GLOBAL: language-only, never zone-prefixed — must stay that
// way (see zonePrefixable.ts). cache() dedupes the fetch within one request —
// generateMetadata and the page component both call this, and without
// cache() that would double the SEO API round-trip per request (the same
// contract getServerSideProps gave for free by running once and handing
// props to both Head and the body).
const loadAboutUsSeo = cache((lang: string) => fetchSeoRow("About us", lang));

// codes/defaultCode drive this page's own hreflang below, AND seed Redux's
// language-code list so Header/Footer's zoneHref() can correctly parse a
// /{lang}/... URL on first paint, same as every other migrated page. See
// LanguageCodesSeed.tsx for why the seeding can't live in the shared root
// layout instead.
const loadLangInfo = cache(async () => {
  const { codes, defaultCode } = await getLanguagesCached();
  return { langCodes: [...codes], defaultCode };
});

// Zone-less canonical (this page is never zone-prefixed) but LANGUAGE-aware —
// same pattern as terms-and-conditions/cancellation-policy. Never pass zone.
const PATH = "/about-us";

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { lang } = await params;
  const [seo, { langCodes, defaultCode }] = await Promise.all([
    loadAboutUsSeo(lang),
    loadLangInfo(),
  ]);

  const pageUrl = canonicalUrl({ lang, zone: null, path: PATH, defaultCode });
  const alternates = hreflangAlternates({
    zone: null,
    path: PATH,
    codes: langCodes,
    defaultCode,
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

export default async function AboutUsRoute({
  params,
}: {
  params: Params;
}) {
  const { lang } = await params;
  const [seo, { langCodes }] = await Promise.all([loadAboutUsSeo(lang), loadLangInfo()]);

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
          ships in the crawler HTML. The page body is CMS HTML with no
          top-level heading of its own, so this is visually hidden — same
          pattern as the home page (see Home.tsx). */}
      {seo.title && <h1 className="sr-only">{seo.title}</h1>}
      <AboutUsPage />
    </div>
  );
}
