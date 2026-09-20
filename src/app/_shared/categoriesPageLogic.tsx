import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import CategoriesPages from "@/components/pagecomponents/CategoriesPages";
import LanguageCodesSeed from "@/app/LanguageCodesSeed";
import { resolveZoneBySlug } from "@/api/zoneResolver";
import { canonicalUrl, hreflangAlternates } from "@/utils/canonicalUrl";
import { getLanguagesCached } from "@/api/languageResolver";
import { buildPageMetadata } from "@/utils/buildMetadata";

const PATH = "/categories";

// [zone] is a real route segment now — validate it: an unresolvable zone is a
// dead URL, so 404 rather than quietly serving the default listing under a
// zone URL. No zone = the plain /categories route.
const loadCategoriesIndexData = cache(async (lang: string, zoneSlug: string | null) => {
  const resolved = zoneSlug ? await resolveZoneBySlug(zoneSlug) : null;
  if (zoneSlug && !resolved) return { notFound: true as const };
  const { codes, defaultCode: langDefault } = await getLanguagesCached();
  return {
    notFound: false as const,
    zone: resolved?.zone?.slug ?? null,
    langCodes: [...codes],
    langDefault,
  };
});

export async function generateCategoriesMetadata(lang: string, zone: string | null): Promise<Metadata> {
  const data = await loadCategoriesIndexData(lang, zone);
  if (data.notFound) return {};

  // Self-referential canonical across both axes, same rule as products/home.
  const pageUrl = canonicalUrl({ lang, zone: data.zone, path: PATH, defaultCode: data.langDefault });
  const alternates = hreflangAlternates({
    zone: data.zone,
    path: PATH,
    codes: data.langCodes,
    defaultCode: data.langDefault,
  });

  return buildPageMetadata({
    pageName: PATH,
    ogUrl: pageUrl,
    canonicalUrl: pageUrl,
    alternates,
  });
}

export async function CategoriesIndexBody({ lang, zone }: { lang: string; zone: string | null }) {
  const data = await loadCategoriesIndexData(lang, zone);
  if (data.notFound) notFound();

  return (
    <>
      <LanguageCodesSeed codes={data.langCodes} />
      <CategoriesPages />
    </>
  );
}
