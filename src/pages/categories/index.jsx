import React from "react";
import dynamic from "next/dynamic";
import MetaData from "@/components/metadata-component/MetaData";
import { resolveZoneBySlug } from "@/api/zoneResolver";
import { getLanguagesCached } from "@/api/languageResolver";
import { canonicalUrl, hreflangAlternates } from "@/utils/canonicalUrl";

const CategoriesPages = dynamic(
  () => import("@/components/pagecomponents/CategoriesPages"),
  { ssr: false }
);

let serverSidePropsFunction = null;

if (process.env.NEXT_PUBLIC_SEO == "true") {
  serverSidePropsFunction = async (context) => {
    const lang = context.query.lang ?? null;

    // Middleware rewrites /{zone}/categories here with ?zone=<slug>. Validate it:
    // an unresolvable zone is a dead URL, so 404 rather than quietly serving the
    // default listing under a zone URL. No zone = the legacy /categories route.
    const zoneSlug = context.query.zone;
    const resolved = zoneSlug ? await resolveZoneBySlug(zoneSlug) : null;
    if (zoneSlug && !resolved) {
      return { notFound: true };
    }

    // Language codes AND the default both come from the API — never hardcoded.
    const { codes, defaultCode: langDefault } = await getLanguagesCached();

    return {
      props: {
        zone: resolved?.zone?.slug ?? null,
        lang,
        langCodes: [...codes],
        langDefault,
      },
    };
  };
}

export const getServerSideProps = serverSidePropsFunction;

// Top-level categories listing. `Category` reads `slug` from router.query; with
// no slug it fetches all categories (slug_id = ""), giving the full grid. Tapping
// a category routes into /categories/[slug].
const CategoriesIndex = ({ zone, lang, langCodes, langDefault }) => {
  // Self-referential canonical across both axes, same rule as products/home.
  const pageUrl = canonicalUrl({
    lang,
    zone,
    path: "/categories",
    defaultCode: langDefault,
  });
  const alternates = hreflangAlternates({
    zone,
    path: "/categories",
    codes: langCodes,
    defaultCode: langDefault,
  });
  return (
    <div>
      <MetaData pageName="/categories" ogUrl={pageUrl} alternates={alternates} />
      <CategoriesPages />
    </div>
  );
};

export default CategoriesIndex;
