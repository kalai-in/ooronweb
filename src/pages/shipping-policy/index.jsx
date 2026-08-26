import MetaData from "@/components/metadata-component/MetaData";
const ShippingPolicyPage = dynamic(
  import("@/components/pagecomponents/ShippingPolicyPage"),
  { ssr: false },
);
import { extractJSONFromMarkup } from "@/utils/helperFunction";
import { resolveZoneBySlug } from "@/api/zoneResolver";
import { selectSeoRow, pickSeoField } from "@/utils/selectSeoRow";
import axios from "axios";
import dynamic from "next/dynamic";
import React from "react";


let serverSidePropsFunction = null;

if(process.env.NEXT_PUBLIC_SEO == "true"){
serverSidePropsFunction = async(context) => {
  const lang = context.query.lang;
  // Zone slug from middleware (if any) → resolver result, so the zone's own
  // SEO row can be selected. An unresolvable slug is still a dead URL: 404.
  const zoneSlug = context.query.zone;
  const resolved = zoneSlug ? await resolveZoneBySlug(zoneSlug) : null;
  if (zoneSlug && !resolved) {
    return { notFound: true };
  }
  const defaultProps = {
      title: process.env.NEXT_PUBLIC_META_TITLE,
      description: process.env.NEXT_PUBLIC_META_DESCRIPTION,
      keywords: process.env.NEXT_PUBLIC_META_KEYWORDS,
      schemaMarkup: null,
      ogImage: "",
      favicon: null,
    };
    let metatitle = defaultProps.title;
    let metaDescription = defaultProps.description;
    let metaKeywords = defaultProps.keywords;
    let ogImage = defaultProps.ogImage;
    let schemaMarkup = null;
    let favicon = defaultProps.favicon;
  try {
    const response = await axios.get(
      `${process.env.NEXT_PUBLIC_API_URL}${process.env.NEXT_PUBLIC_API_SUBURL}/settings/get_seo_settings`,
      {
        params: {
          page_type: "Shipping policy",
        },
        headers: {
          "Content-Language": lang,
        },
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
      },
    };
  } catch (error) {
    console.log("error", error);
    return{props:defaultProps}
  }
}
}

export const getServerSideProps = serverSidePropsFunction



const index = ({ title, description, keywords, ogImage, schemaMarkup,favicon }) => {
  const pageUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/shipping-policy`;
  return (
    <div>
      <MetaData
        pageName="/shipping-policy"
        title={title}
        description={description}
        keywords={keywords}
        ogUrl={pageUrl}
        ogImage={ogImage}
        structuredData={schemaMarkup}
        favicon={favicon}
      />
      <ShippingPolicyPage />
    </div>
  );
};

export default index;
