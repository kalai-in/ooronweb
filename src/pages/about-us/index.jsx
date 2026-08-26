import MetaData from "@/components/metadata-component/MetaData";
import { extractJSONFromMarkup } from "@/utils/helperFunction";
import { selectSeoRow, pickSeoField } from "@/utils/selectSeoRow";
const AboutUsPage = dynamic(
  () => import("@/components/pagecomponents/AboutUsPage"),
  { ssr: false }
);
import axios from "axios";
import dynamic from "next/dynamic";
import React from "react";

let serverSidePropsFunction = null;

if (process.env.NEXT_PUBLIC_SEO == "true") {
  serverSidePropsFunction = async (context) => {
    const lang = context.query.lang;
    const defaultProps = {
      title: process.env.NEXT_PUBLIC_META_TITLE,
      description: process.env.NEXT_PUBLIC_META_DESCRIPTION,
      keywords: process.env.NEXT_PUBLIC_META_KEYWORDS,
      schemaMarkup: null,
      ogImage: "",
      favicon: null,
    };

    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}${process.env.NEXT_PUBLIC_API_SUBURL}/settings/get_seo_settings`,
        {
          params: {
            page_type: "About us",
          },
          headers: {
            "Content-Language": lang,
          },
        }
      );
      let metatitle = defaultProps.title;
      let metaDescription = defaultProps.description;
      let metaKeywords = defaultProps.keywords;
      let ogImage = defaultProps.ogImage;
      let schemaMarkup = null;
      let favicon = defaultProps.favicon;
      // Zone row when the URL carries one, else the is_default row (this route
      // is never zone-prefixed, so the default row always wins).
      const seo = selectSeoRow(response.data.data, null);
      if (process.env.NEXT_PUBLIC_SEO == "true" && seo) {
        const pick = (key) => pickSeoField(seo, key);
        metatitle = pick("meta_title") || defaultProps.title;
        metaDescription = pick("meta_description") || defaultProps.description;
        metaKeywords = pick("meta_keyword") || defaultProps.keywords;
        ogImage = pick("og_image_url") || defaultProps.ogImage;
        const rawSchema = pick("schema_markup");
        if (rawSchema) {
          schemaMarkup = extractJSONFromMarkup(rawSchema);
        }
        favicon = pick("favicon") || defaultProps.favicon;
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
      return { props: defaultProps };
    }
  };
}

export const getServerSideProps = serverSidePropsFunction;

const Index = ({
  title,
  description,
  keywords,
  schemaMarkup,
  ogImage,
  favicon,
}) => {
  const currentURL = `${process.env.NEXT_PUBLIC_BASE_URL}/about-us`;
  return (
    <div>
      <MetaData
        pageName="/about"
        title={title}
        description={description}
        keywords={keywords}
        structuredData={schemaMarkup}
        ogImage={ogImage}
        ogUrl={currentURL}
        favicon={favicon}
      />
      <AboutUsPage />
    </div>
  );
};

export default Index;
