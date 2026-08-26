import MetaData from "@/components/metadata-component/MetaData";
const CancellationPolicyPage = dynamic(
  import("@/components/pagecomponents/CancellationPolicyPage"),
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
  const defaultProps = {
    title: process.env.NEXT_PUBLIC_META_TITLE,
    description: process.env.NEXT_PUBLIC_META_DESCRIPTION,
    keywords: process.env.NEXT_PUBLIC_META_KEYWORDS,
    schemaMarkup: null,
    ogImage: "",
    favicon: null,
  };
  serverSidePropsFunction = async (context) => {
    let metatitle = defaultProps.title;
    let metaDescription = defaultProps.description;
    let metaKeywords = defaultProps.keywords;
    let ogImage = defaultProps.ogImage;
    let schemaMarkup = null;
    let favicon = defaultProps.favicon;
    const lang = context.query.lang;
    // Zone slug from middleware (if any) → resolver result, so the zone's own
    // SEO row can be selected. An unresolvable slug is still a dead URL: 404.
    const zoneSlug = context.query.zone;
    const resolved = zoneSlug ? await resolveZoneBySlug(zoneSlug) : null;
    if (zoneSlug && !resolved) {
      return { notFound: true };
    }
    // Language codes + default from the API for hreflang.
    const { codes, defaultCode: langDefault } = await getLanguagesCached();
    const langCodes = [...codes];
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}${process.env.NEXT_PUBLIC_API_SUBURL}/settings/get_seo_settings`,
        {
          params: {
            page_type: "Cancellation policy",
          },
          headers: {
            "Content-Language": lang,
          }
        },
      );

      // Zone row when the URL carries one, else the is_default row (see selectSeoRow).
      const seo = selectSeoRow(response.data.data, resolved?.zone?.id ?? null);
      if (process.env.NEXT_PUBLIC_SEO == "true" && seo) {
        const pick = (key) => pickSeoField(seo, key);
        metatitle = pick("meta_title") || defaultProps.title;
        metaDescription = pick("meta_description") || defaultProps.title;
        metaKeywords = pick("meta_keyword") || defaultProps.keywords;
        ogImage = pick("og_image_url") || defaultProps.ogImage;
        favicon = pick("favicon") || defaultProps.favicon;
        const rawSchema = pick("schema_markup");
        if (rawSchema) {
          schemaMarkup = extractJSONFromMarkup(rawSchema) || defaultProps.schemaMarkup;
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
      return {
        props: { ...defaultProps, lang: lang ?? null, langCodes, langDefault },
      };
    }
  };
}

export const getServerSideProps = serverSidePropsFunction;

const index = ({
  title,
  description,
  keywords,
  ogImage,
  schemaMarkup,
  favicon,
  lang,
  langCodes,
  langDefault,
}) => {
  // Zone-less canonical (identical text per zone), language-aware, + hreflang so
  // localized variants aren't treated as duplicates. Previously computed pageUrl
  // was never passed, so canonical silently fell back to the bare default URL.
  const path = "/cancellation-policy";
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
        pageName="/cancellation-policy"
        title={title}
        description={description}
        keywords={keywords}
        structuredData={schemaMarkup}
        ogImage={ogImage}
        ogUrl={pageUrl}
        alternates={alternates}
        favicon={favicon}
      />
      <CancellationPolicyPage />
    </div>
  );
};

export default index;
