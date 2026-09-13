import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import PrivacyPolicyPage from "@/components/pagecomponents/PrivacyPolicyPage";
import { fetchSeoRow, resolveZoneForSeo } from "@/utils/fetchSeoRow";
import { buildPageMetadata } from "@/utils/buildMetadata";
import { canonicalUrl, hreflangAlternates } from "@/utils/canonicalUrl";
import { getLanguagesCached } from "@/api/languageResolver";
import LanguageCodesSeed from "@/app/LanguageCodesSeed";

type Params = Promise<{ lang: string }>;

// This route is GLOBAL: language-only, never zone-prefixed (lives under
// [lang]/(plain)/, with no [zone] ancestor — must stay that way, see
// zonePrefixable.ts). resolveZoneForSeo(undefined) always resolves to the
// is_default SEO row, same as before the move to real path segments.
const loadPrivacyPolicySeo = cache(async (lang: string) => {
  const { zoneId, notFound: zoneNotFound } = await resolveZoneForSeo(undefined);
  if (zoneNotFound) return { notFound: true as const };
  const seo = await fetchSeoRow("Privacy policy", lang, zoneId);
  // codes/langDefault drive hreflang below AND seed Redux's language-code
  // list so Header/Footer's zoneHref() can correctly parse a /{lang}/... URL
  // on first paint. See LanguageCodesSeed.tsx.
  const { codes, defaultCode: langDefault } = await getLanguagesCached();
  return { notFound: false as const, seo, langCodes: [...codes], langDefault };
});

// Zone-less canonical (policy text is identical for every zone) but
// LANGUAGE-aware: a non-default locale keeps its /{lang}/ prefix so variants
// aren't seen as duplicates, and hreflang ties the translations together.
// Same pattern as terms-and-conditions/cancellation-policy — never pass zone.
const PATH = "/privacy-policy";

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { lang } = await params;
  const result = await loadPrivacyPolicySeo(lang);
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

export default async function PrivacyPolicyRoute({
  params,
}: {
  params: Params;
}) {
  const { lang } = await params;
  const result = await loadPrivacyPolicySeo(lang);
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
      <PrivacyPolicyPage />
    </div>
  );
}
