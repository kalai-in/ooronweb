import MetaData from "@/components/metadata-component/MetaData";
const TermsAndCondititionsPage = dynamic(
  () => import("@/components/pagecomponents/TermsAndCondititionsPage"),
  { ssr: false },
);
import { extractJSONFromMarkup } from "@/utils/helperFunction";
import { canonicalUrl, hreflangAlternates } from "@/utils/canonicalUrl";
import { getLanguagesCached } from "@/api/languageResolver";
import { resolveZoneBySlug } from "@/api/zoneResolver";
import { selectSeoRow, pickSeoField } from "@/utils/selectSeoRow";
import axios from "axios";
import dynamic from "next/dynamic";
import React from "react";

let serverSidePropsFunction = null;

if (process.env.NEXT_PUBLIC_SEO == "true") {
  serverSidePropsFunction = async (context) => {
    const lang = context.query.lang;
    // Zone slug from middleware (if any) → resolver result, so the zone's own
    // SEO row can be selected. An unresolvable slug is still a dead URL: 404.
    const zoneSlug = context.query.zone;
    const resolved = zoneSlug ? await resolveZoneBySlug(zoneSlug) : null;
    if (zoneSlug && !resolved) {
      return { notFound: true };
    }
    // Language codes + default from the API (never hardcoded) for hreflang.
    const { codes, defaultCode: langDefault } = await getLanguagesCached();
    const langCodes = [...codes];
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}${process.env.NEXT_PUBLIC_API_SUBURL}/settings/get_seo_settings`,
        {
          params: {
            page_type: "Term condition",
          },
          headers: {
            "Content-Language": lang,
          },
        },
      );
      let metatitle = process.env.NEXT_PUBLIC_META_TITLE;
      let metaDescription = process.env.NEXT_PUBLIC_META_DESCRIPTION;
      let metaKeywords = process.env.NEXT_PUBLIC_META_KEYWORDS;
      let ogImage = "";
      let favicon = null;
      let schemaMarkup = null;
      // Zone row when the URL carries one, else the is_default row (see selectSeoRow).
      const seo = selectSeoRow(response.data.data, resolved?.zone?.id ?? null);
      if (process.env.NEXT_PUBLIC_SEO == "true" && seo) {
        const pick = (key) => pickSeoField(seo, key);
        metatitle = pick("meta_title") || metatitle;
        metaDescription = pick("meta_description") || metaDescription;
        metaKeywords = pick("meta_keyword") || metaKeywords;
        ogImage = pick("og_image_url") || ogImage;
        favicon = pick("favicon") || favicon;
        const rawSchema = pick("schema_markup");
        if (rawSchema) {
          schemaMarkup = extractJSONFromMarkup(rawSchema);
        }
      }
      return {
        props: {
          title: metatitle,
          description: metaDescription,
          keywords: metaKeywords,
          schemaMarkup: schemaMarkup ? JSON.stringify(schemaMarkup) : null,
          ogImage: ogImage,
          favicon: favicon ? favicon : null,
          lang: lang ?? null,
          langCodes,
          langDefault,
        },
      };
    } catch (error) {
      console.log("error", error);
      // Keep lang info so a failed SEO fetch still emits a correct localized
      // canonical/hreflang rather than dropping to the bare default URL.
      return {
        props: {
          lang: lang ?? null,
          langCodes,
          langDefault,
        },
      };
    }
  }
}

export const getServerSideProps = serverSidePropsFunction



const index = ({
  title,
  description,
  keywords,
  schemaMarkup,
  ogImage,
  favicon,
  lang,
  langCodes,
  langDefault,
}) => {
  // Zone-less canonical (policy text is identical in every zone) but LANGUAGE-aware:
  // a non-default locale keeps its /{lang}/ prefix so variants aren't seen as
  // duplicates, and hreflang ties the translations together.
  const path = "/terms-and-conditions";
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
        pageName="/terms-and-conditions"
        title={title}
        description={description}
        keywords={keywords}
        structuredData={schemaMarkup}
        ogImage={ogImage}
        ogUrl={pageUrl}
        alternates={alternates}
        favicon={favicon}
      />
      <TermsAndCondititionsPage />
    </div>
  );
};

export default index;
