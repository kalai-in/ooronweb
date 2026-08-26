  import React from "react";
  import dynamic from "next/dynamic";
  const BlogsPage = dynamic(
    () => import("@/components/pagecomponents/BlogsPage"),
    { ssr: false }
  );

  import MetaData from "@/components/metadata-component/MetaData";
  import axios from "axios";
  import { extractJSONFromMarkup } from "@/utils/helperFunction";
  import { selectSeoRow, pickSeoField } from "@/utils/selectSeoRow";
  import { canonicalUrl, hreflangAlternates } from "@/utils/canonicalUrl";
  import { getLanguagesCached } from "@/api/languageResolver";

  const fallbackProps = {
    props: {
      title: process.env.NEXT_PUBLIC_META_TITLE || null,
      description: process.env.NEXT_PUBLIC_META_DESCRIPTION || null,
      keywords: process.env.NEXT_PUBLIC_META_KEYWORDS || null,
      schemaMarkup: null,
      ogImage: null,
      favicon: null,
      lang: null,
      langCodes: [],
      langDefault: null,
    },
  };

  let serverSidePropsFunction = null;

  if (process.env.NEXT_PUBLIC_SEO == "true") {
    serverSidePropsFunction = async (context) => {
      const lang = context.query.lang;
      // No zone lookup: /blogs is never zone-prefixed (middleware 308s any legacy
      // /{zone}/blogs here), so ?zone= can no longer arrive and the SEO row is
      // always the default one.
      // Language code list + default from the API for hreflang (never hardcoded).
      const { codes, defaultCode: langDefault } = await getLanguagesCached();
      const langCodes = [...codes];
      try {
        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}${process.env.NEXT_PUBLIC_API_SUBURL}/settings/get_seo_settings`,
          {
            params: {
              page_type: "Blog Listing Page",
            },
            headers: {
              "Content-Language": lang,
            },
          },
        );

        let metatitle = process.env.NEXT_PUBLIC_META_TITLE || null;
        let metaDescription = process.env.NEXT_PUBLIC_META_DESCRIPTION || null;
        let metaKeywords = process.env.NEXT_PUBLIC_META_KEYWORDS || null;
        let ogImage = null;
        let schemaMarkup = null;
        let favicon = null;

        // Zone row when the URL carries one, else the is_default row.
        const seo = selectSeoRow(response.data.data, null);
        if (process.env.NEXT_PUBLIC_SEO == "true" && seo) {
          const pick = (key) => pickSeoField(seo, key);
          metatitle = pick("meta_title") || metatitle;
          metaDescription = pick("meta_description") || metaDescription;
          metaKeywords = pick("meta_keyword") || metaKeywords;
          ogImage = pick("og_image_url") || ogImage;
          favicon = pick("favicon") || favicon;
          const rawSchema = pick("schema_markup");
          if (rawSchema) {
            schemaMarkup = extractJSONFromMarkup(rawSchema) || schemaMarkup;
          }
        }

        return {
          props: {
            title: metatitle,
            description: metaDescription,
            keywords: metaKeywords,
            // Stringify — MetaData injects this via dangerouslySetInnerHTML, and a
            // non-string object coerces to "[object Object]" (invalid JSON-LD).
            schemaMarkup:
              schemaMarkup && typeof schemaMarkup !== "string"
                ? JSON.stringify(schemaMarkup)
                : schemaMarkup,
            ogImage: ogImage,
            favicon: favicon,
            lang: lang ?? null,
            langCodes,
            langDefault,
          },
        };
      } catch (error) {
        console.log("error", error);
        return fallbackProps;
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
    lang,
    langCodes,
    langDefault,
  }) => {
    // Zone COLLAPSED (zone: null) for the same reason as the blog detail page: the
    // listing is identical in every zone, so the canonical points at the zone-less
    // language variant while the zone still rides the browser URL for navigation.
    const path = "/blogs";
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
          title={title}
          description={description}
          keywords={keywords}
          structuredData={schemaMarkup}
          ogImage={ogImage}
          pageName="/blogs"
          ogUrl={pageUrl}
          alternates={alternates}
          favicon={favicon}
        />
        <BlogsPage />
      </div>
    );
  };

  export default index;