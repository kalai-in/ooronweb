import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import TermsAndCondititionsPage from "@/components/pagecomponents/TermsAndCondititionsPage";
import LanguageCodesSeed from "@/app/LanguageCodesSeed";
import { fetchSeoRow, resolveZoneForSeo } from "@/utils/fetchSeoRow";
import { buildPageMetadata } from "@/utils/buildMetadata";
import { canonicalUrl, hreflangAlternates } from "@/utils/canonicalUrl";
import { getLanguagesCached } from "@/api/languageResolver";

type Params = Promise<{ lang: string }>;

// This route is never zone-prefixed (lives under [lang]/(plain)/, with no
// [zone] ancestor) — resolveZoneForSeo(undefined) always resolves to the
// is_default SEO row, same as before the move to real path segments.
const loadTermsData = cache(async (lang: string) => {
  const { zoneId, notFound: zoneNotFound } = await resolveZoneForSeo(undefined);
  if (zoneNotFound) return { notFound: true as const };
  // Language codes + default from the API (never hardcoded) for hreflang —
  // fetched independently of the SEO row so canonical/hreflang still work
  // even if the SEO API call itself fails.
  const { codes, defaultCode: langDefault } = await getLanguagesCached();
  const seo = await fetchSeoRow("Term condition", lang, zoneId);
  return { notFound: false as const, seo, langCodes: [...codes], langDefault };
});

// Zone-less canonical (policy text is identical in every zone) but
// LANGUAGE-aware: a non-default locale keeps its /{lang}/ prefix so variants
// aren't seen as duplicates, and hreflang ties the translations together.
const PATH = "/terms-and-conditions";

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { lang } = await params;
  const result = await loadTermsData(lang);
  if (result.notFound) return {};

  const pageUrl = canonicalUrl({
    lang,
    zone: null,
    path: PATH,
    defaultCode: result.langDefault,
  });
  const alternates = hreflangAlternates({
    zone: null,
    path: PATH,
    codes: result.langCodes,
    defaultCode: result.langDefault,
  });

  return buildPageMetadata({
    title: result.seo.title,
    description: result.seo.description,
    keywords: result.seo.keywords,
    pageName: PATH,
    ogImage: result.seo.ogImage,
    ogUrl: pageUrl,
    canonicalUrl: pageUrl,
    alternates,
    favicon: result.seo.favicon,
  });
}

export default async function TermsAndConditionsRoute({
  params,
}: {
  params: Params;
}) {
  const { lang } = await params;
  const result = await loadTermsData(lang);
  if (result.notFound) notFound();

  return (
    <div>
      <LanguageCodesSeed codes={result.langCodes} />
      {result.seo.schemaMarkup && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: result.seo.schemaMarkup }}
        />
      )}
      {/* Single page H1 for SEO/accessibility, rendered server-side so it
          ships in the crawler HTML. The policy body is CMS HTML with no
          top-level heading of its own, so this is visually hidden — same
          pattern as the home page (see Home.tsx). */}
      {result.seo.title && <h1 className="sr-only">{result.seo.title}</h1>}
      <TermsAndCondititionsPage />
    </div>
  );
}
