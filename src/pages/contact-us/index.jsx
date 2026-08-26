import MetaData from "@/components/metadata-component/MetaData";
import { extractJSONFromMarkup } from "@/utils/helperFunction";
import { selectSeoRow, pickSeoField } from "@/utils/selectSeoRow";
import axios from "axios";
import dynamic from "next/dynamic";
const ContactUsPage = dynamic(
  () => import("@/components/pagecomponents/ContactUsPage"),
  { ssr: false },
);
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
            page_type: "Contact us",
          },
          headers: {
            "Content-Language": lang,
          }
        },
      );
      let metatitle = process.env.NEXT_PUBLIC_META_TITLE;
      let metaDescription = process.env.NEXT_PUBLIC_META_DESCRIPTION;
      let metaKeywords = process.env.NEXT_PUBLIC_META_KEYWORDS;
      let ogImage = "";
      let favicon = null;
      let schemaMarkup = null;
      // Zone row when the URL carries one, else the is_default row (this route
      // is never zone-prefixed, so the default row always wins).
      const seo = selectSeoRow(response.data.data, null);
      if (process.env.NEXT_PUBLIC_SEO == "true" && seo) {
        const pick = (key) => pickSeoField(seo, key);
        metatitle = pick("meta_title") || defaultProps.title;
        metaDescription = pick("meta_description") || defaultProps.description;
        metaKeywords = pick("meta_keyword") || defaultProps.keywords;
        ogImage = pick("og_image_url") || defaultProps.ogImage;
        favicon = pick("favicon") || defaultProps.favicon;
        const rawSchema = pick("schema_markup");
        if (rawSchema) {
          schemaMarkup =
            extractJSONFromMarkup(rawSchema) || defaultProps.schemaMarkup;
        }
      }
      return {
        props: {
          title: metatitle,
          description: metaDescription,
          keywords: metaKeywords,
          structuredData: schemaMarkup,
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

const index = ({
  title,
  description,
  keywords,
  schemaMarkup,
  ogImage,
  favicon,
}) => {
  const pageUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/contact-us`;

  return (
    <div>
      <MetaData
        title={title}
        description={description}
        keywords={keywords}
        structuredData={schemaMarkup}
        ogImage={ogImage}
        pageName="/contact-us"
        ogUrl={pageUrl}
        favicon={favicon}
      />
      <ContactUsPage />
    </div>
  );
};

export default index;
