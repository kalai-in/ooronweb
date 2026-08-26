import React from "react";
import { useSelector } from "react-redux";
import Head from "next/head";
const MetaData = ({
  // Basic SEO
  title = process.env.NEXT_PUBLIC_META_TITLE,
  description = process.env.NEXT_PUBLIC_META_DESCRIPTION,
  keywords = process.env.NEXT_PUBLIC_META_KEYWORDS,
  author = process.env.NEXT_PUBLIC_WEB_NAME, // Using app name as author
  language = "en",
  pageName = "", // To append to base URL

  // Open Graph / Facebook - Using same as basic meta for consistency
  ogTitle = title,
  ogDescription = description,
  ogImage = "/favicon.webp", // Using favicon as default OG image
  ogUrl = `${process.env.NEXT_PUBLIC_BASE_URL}${pageName}`,
  siteName = process.env.NEXT_PUBLIC_META_TITLE,

  // Twitter - Using same as OG for consistency
  twitterCard = "summary_large_image",
  twitterTitle = ogTitle,
  twitterDescription = ogDescription,
  twitterImage = ogImage,
  twitterSite = `@${process.env.NEXT_PUBLIC_META_TITLE}`,
  twitterCreator = `@${process.env.NEXT_PUBLIC_META_TITLE}`,

  // Additional SEO
  canonicalUrl = ogUrl,
  // hreflang alternates: [{ hrefLang, href }]. Emitted as <link rel="alternate">
  // so Google links the localized variants instead of reading them as duplicates.
  alternates = null,
  robots = "index, follow",
  themeColor = "#000000",

  // Structured Data
  structuredData = null,

  // PWA
  manifestUrl = "/manifest.json",
  appleTouchIcon = "/favicon.ico",
  favicon,
}) => {
  const setting = useSelector((state) => state.Setting.setting);

  let finalFavicon =
    favicon == "" || favicon == undefined ? setting?.favicon : favicon;

  return (
    <Head>
      {/* Basic SEO */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content={author} />
      <meta name="robots" content={robots} />
      <meta name="language" content={language} />
      {/* No maximum-scale/user-scalable=no. Blocking pinch-zoom fails WCAG
          1.4.4 (Resize Text) and is what Lighthouse's "[user-scalable=no] is
          used" audit flags. Low-vision users on mobile need to zoom; the
          layout is responsive, so nothing breaks when they do. */}
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={ogTitle} />
      <meta property="og:description" content={ogDescription} />
      <meta property="og:image" content={ogImage} />
      {/* No og:image:width/height. They were hardcoded to 1200x630, but the
          image is whatever the admin uploaded via seo_settings — a 447x436 file
          declared as 1200x630 makes WhatsApp/Facebook lay out the preview for
          dimensions the fetched file doesn't have, and they drop the image
          rather than render it. Omitting the hints lets each scraper measure
          the real file. If they're ever restored, they must be derived from the
          actual asset, not assumed. */}
      <meta property="og:url" content={ogUrl} />
      <meta property="og:site_name" content={siteName} />
      <meta property="og:locale" content="en_US" />

      {/* Twitter */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:title" content={twitterTitle} />
      <meta name="twitter:description" content={twitterDescription} />
      <meta name="twitter:image" content={twitterImage} />
      <meta name="twitter:site" content={twitterSite} />
      <meta name="twitter:creator" content={twitterCreator} />

      {/* Canonical URL */}
      <link rel="canonical" href={canonicalUrl} />

      {/* hreflang alternates — one per language + x-default */}
      {Array.isArray(alternates) &&
        alternates.map((alt) => (
          <link
            key={alt.hrefLang}
            rel="alternate"
            hrefLang={alt.hrefLang}
            href={alt.href}
          />
        ))}

      {/* Theme Color */}
      <meta name="theme-color" content={themeColor} />

      {/* PWA */}
      <link rel="manifest" href={manifestUrl} />
      <link rel="apple-touch-icon" href={appleTouchIcon} />

      <link rel="icon" href={finalFavicon ? finalFavicon : "/favicon.webp"} />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="apple-mobile-web-app-title" content={title} />
      <meta name="format-detection" content="telephone=no" />
      <meta name="mobile-web-app-capable" content="yes" />

      {/* Structured Data */}
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: structuredData }}
          key="structured-data"
        />
      )}
    </Head>
  );
};

export default MetaData;
