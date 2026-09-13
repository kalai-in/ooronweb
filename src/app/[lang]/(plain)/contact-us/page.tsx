import type { Metadata } from "next";
import { cache } from "react";
import ContactUsPage from "@/components/pagecomponents/ContactUsPage";
import { fetchSeoRow } from "@/utils/fetchSeoRow";
import { buildPageMetadata } from "@/utils/buildMetadata";
import { canonicalUrl, hreflangAlternates } from "@/utils/canonicalUrl";
import { getLanguagesCached } from "@/api/languageResolver";
import LanguageCodesSeed from "@/app/LanguageCodesSeed";

type Params = Promise<{ lang: string }>;

// This route is GLOBAL: language-only, never zone-prefixed — must stay that
// way (see zonePrefixable.ts).
const loadContactUsSeo = cache((lang: string) => fetchSeoRow("Contact us", lang));

// codes/defaultCode drive this page's own hreflang below, AND seed Redux's
// language-code list so Header/Footer's zoneHref() can parse a /{lang}/...
// URL on first paint — see LanguageCodesSeed.tsx.
const loadLangInfo = cache(async () => {
  const { codes, defaultCode } = await getLanguagesCached();
  return { langCodes: [...codes], defaultCode };
});

// Zone-less canonical but LANGUAGE-aware — same pattern as
// terms-and-conditions/cancellation-policy. Never pass zone.
const PATH = "/contact-us";

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { lang } = await params;
  const [seo, { langCodes, defaultCode }] = await Promise.all([
    loadContactUsSeo(lang),
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

export default async function ContactUsRoute({
  params,
}: {
  params: Params;
}) {
  const { lang } = await params;
  const [seo, { langCodes }] = await Promise.all([loadContactUsSeo(lang), loadLangInfo()]);

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
          ships in the crawler HTML. The page body has no top-level heading
          of its own, so this is visually hidden — same pattern as the home
          page (see Home.tsx). */}
      {seo.title && <h1 className="sr-only">{seo.title}</h1>}
      <ContactUsPage />
    </div>
  );
}
