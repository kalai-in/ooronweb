import type { Metadata } from "next";

export type HreflangAlternate = { hrefLang: string; href: string };

export type PageMetadataInput = {
  title?: string | null;
  description?: string | null;
  keywords?: string | null;
  pageName?: string;
  ogImage?: string | null;
  ogUrl?: string;
  favicon?: string | null;
  alternates?: HreflangAlternate[] | null;
  canonicalUrl?: string;
  robots?: string;
};

/**
 * Maps the same fields MetaData.jsx rendered via next/head into the App
 * Router Metadata API, for parity across the SSR content pages migrating in
 * Batch 2+. Structured data (JSON-LD) is NOT expressible here — the Metadata
 * API has no field for it — callers render it as a literal
 * <script type="application/ld+json"> in the page body instead.
 *
 * MetaData.jsx's Redux-sourced favicon fallback (`setting?.favicon` when no
 * per-page favicon was supplied) is NOT replicated here: that fallback only
 * ever ran client-side (generateMetadata has no Redux), and none of the
 * pages migrating in this batch called a server-side settings fetch for it
 * either — so this preserves the exact SSR output these pages already
 * produced, not the client-only extra behavior.
 */
export function buildPageMetadata({
  title,
  description,
  keywords,
  pageName = "",
  ogImage,
  ogUrl,
  favicon,
  alternates,
  canonicalUrl,
  robots = "index, follow",
}: PageMetadataInput): Metadata {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "";
  const resolvedOgUrl = ogUrl || `${baseUrl}${pageName}`;
  const resolvedCanonical = canonicalUrl || resolvedOgUrl;
  const resolvedOgImage = ogImage || "/favicon.webp";
  const resolvedFavicon = favicon || "/favicon.webp";
  const siteName = process.env.NEXT_PUBLIC_META_TITLE;

  const languages: Record<string, string> | undefined = alternates?.length
    ? Object.fromEntries(alternates.map((a) => [a.hrefLang, a.href]))
    : undefined;

  return {
    title,
    description: description || undefined,
    keywords: keywords || undefined,
    authors: process.env.NEXT_PUBLIC_WEB_NAME
      ? [{ name: process.env.NEXT_PUBLIC_WEB_NAME }]
      : undefined,
    robots,
    alternates: {
      canonical: resolvedCanonical,
      languages,
    },
    openGraph: {
      type: "website",
      title: title || undefined,
      description: description || undefined,
      images: resolvedOgImage ? [resolvedOgImage] : undefined,
      url: resolvedOgUrl,
      siteName,
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: title || undefined,
      description: description || undefined,
      images: resolvedOgImage ? [resolvedOgImage] : undefined,
      site: siteName ? `@${siteName}` : undefined,
      creator: siteName ? `@${siteName}` : undefined,
    },
    icons: {
      icon: resolvedFavicon,
      apple: "/icons/apple-touch-icon.png",
    },
    // manifest.webmanifest is auto-linked from src/app/manifest.ts.
    appleWebApp: {
      capable: true,
      statusBarStyle: "default",
      title: title || process.env.NEXT_PUBLIC_WEB_NAME || undefined,
    },
    other: {
      "mobile-web-app-capable": "yes",
      "format-detection": "telephone=no",
    },
  };
}
