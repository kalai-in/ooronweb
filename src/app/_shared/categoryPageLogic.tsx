import type { Metadata } from "next";
import { cache } from "react";
import axios from "axios";
import CategoriesPages from "@/components/pagecomponents/CategoriesPages";
import LanguageCodesSeed from "@/app/LanguageCodesSeed";
import Custom404 from "@/components/notfound/Custom404";
import { extractJSONFromMarkup } from "@/utils/helperFunction";
import { resolveZoneBySlug } from "@/api/zoneResolver";
import { getLanguagesCached } from "@/api/languageResolver";
import { canonicalUrl, hreflangAlternates } from "@/utils/canonicalUrl";
import { buildPageMetadata } from "@/utils/buildMetadata";
import {
  getCategoriesTreeServer,
  getCategoryChildrenServer,
} from "@/api/serverApi";
import { findNodeBySlug } from "@/utils/categorySlugResolver";

// Must match Category.tsx's own categoryPerPage. The seeded page and the
// client's own fetch have to agree on page size or the offset diverges.
const CATEGORY_CHILDREN_PER_PAGE = 12;

type CategorySlugData = {
  notFoundPage: boolean;
  slug: string;
  metaKeywords: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  markUpSchema: string;
  og_image: string | null;
  favicon: string | null;
  zone: string | null;
  lang: string | null;
  langCodes: string[];
  langDefault: string;
  initialCategory: any;
};

const loadCategorySlugData = cache(
  async (slug: string, lang: string, zoneSlug: string | null): Promise<CategorySlugData> => {
    // [zone] is a real route segment now. An unresolvable zone is a dead URL
    // -> 404, rather than serving the default listing under it.
    const resolved = zoneSlug ? await resolveZoneBySlug(zoneSlug) : null;
    if (zoneSlug && !resolved) {
      return {
        notFoundPage: true,
        slug,
        metaKeywords: null,
        metaTitle: null,
        metaDescription: null,
        markUpSchema: "",
        og_image: null,
        favicon: null,
        zone: null,
        lang: lang ?? null,
        langCodes: ["en"],
        langDefault: "en",
        initialCategory: null,
      };
    }
    const zone = resolved?.zone?.slug ?? null;
    // Codes AND default from the API — never hardcoded.
    const { codes, defaultCode: langDefault } = await getLanguagesCached();
    const langCodes = [...codes];

    // Seeds Category.tsx's heading + first page of subcategory tiles so a
    // direct/crawler load doesn't show a blank title and an empty grid until
    // the client fetches. Coordinates are REQUIRED by the categories API
    // (same constraint as getProductListingServer) — skipped when the zone
    // resolved no polygon centroid, same as the products page.
    const ssrLat = resolved?.latitude ?? null;
    const ssrLng = resolved?.longitude ?? null;
    const ssrChannel = resolved?.channel;
    let initialCategory: any = null;
    if (ssrLat != null && ssrLng != null) {
      try {
        const [tree, children]: [any, any] = await Promise.all([
          getCategoriesTreeServer({
            latitude: ssrLat,
            longitude: ssrLng,
            lang,
            channel: ssrChannel,
          }),
          getCategoryChildrenServer({
            slug: slug === "all" ? "" : slug,
            latitude: ssrLat,
            longitude: ssrLng,
            lang,
            channel: ssrChannel,
            limit: CATEGORY_CHILDREN_PER_PAGE,
            offset: 0,
          }),
        ]);
        const node = findNodeBySlug(tree?.data ?? [], slug);
        if (children?.status == 1) {
          initialCategory = {
            name: node?.translations?.name || node?.name || null,
            children: children.data ?? [],
            total: children.total ?? 0,
            latitude: ssrLat,
            longitude: ssrLng,
          };
        }
      } catch (err: any) {
        // Never fail the page on this — the client refetches on mount.
        console.log("[categories] children fetch failed:", err?.message);
      }
    }
    try {
      const response = await axios.get(
        `${process.env.NEXT_PUBLIC_API_URL}${process.env.NEXT_PUBLIC_API_SUBURL}/categories/get_seo`,
        {
          params: { slug },
          headers: { "Content-Language": lang },
        },
      );
      const seoData = response?.data.data || {};
      const metaKeywords = seoData?.translations?.meta_keywords || process.env.NEXT_PUBLIC_META_KEYWORDS || "";
      const metaTitle = seoData?.translations?.meta_title || process.env.NEXT_PUBLIC_META_TITLE || "";
      const metaDescription =
        seoData?.translations?.meta_description || process.env.NEXT_PUBLIC_META_DESCRIPTION || "";
      const og_image = seoData?.og_image || null;
      const favicon = seoData.favicon || null;
      const markUpSchema = seoData?.translations?.schema_markup
        ? extractJSONFromMarkup(seoData?.translations?.schema_markup) || ""
        : "";

      return {
        notFoundPage: false,
        slug,
        metaKeywords,
        metaTitle,
        metaDescription,
        // Stringify — a raw object coerces to "[object Object]" (invalid JSON-LD).
        markUpSchema:
          markUpSchema && typeof markUpSchema !== "string" ? JSON.stringify(markUpSchema) : markUpSchema,
        og_image,
        favicon: favicon ? favicon : null,
        zone,
        lang: lang ?? null,
        langCodes,
        langDefault,
        initialCategory,
      };
    } catch (error) {
      console.error("Error fetching product data:", error);
      // A failed get_seo fetch must NOT 404 a category that exists — fall back
      // to default meta and let the client resolve the category by slug.
      return {
        notFoundPage: false,
        slug,
        metaKeywords: process.env.NEXT_PUBLIC_META_KEYWORDS || null,
        metaTitle: process.env.NEXT_PUBLIC_META_TITLE || null,
        metaDescription: process.env.NEXT_PUBLIC_META_DESCRIPTION || null,
        markUpSchema: "",
        og_image: null,
        favicon: null,
        zone,
        lang: lang ?? null,
        langCodes,
        langDefault,
        initialCategory,
      };
    }
  },
);

export async function generateCategoryMetadata(slug: string, lang: string, zone: string | null): Promise<Metadata> {
  const data = await loadCategorySlugData(slug, lang, zone);
  if (data.notFoundPage) return {};

  const path = `/categories/${slug}`;
  const pageUrl = canonicalUrl({ lang: data.lang, zone: data.zone, path, defaultCode: data.langDefault });
  const alternates = hreflangAlternates({
    zone: data.zone,
    path,
    codes: data.langCodes,
    defaultCode: data.langDefault,
  });

  return buildPageMetadata({
    title: data.metaTitle,
    description: data.metaDescription,
    keywords: data.metaKeywords,
    pageName: "/categories/all",
    ogUrl: pageUrl,
    canonicalUrl: pageUrl,
    alternates,
    ogImage: data.og_image,
    favicon: data.favicon,
  });
}

export async function CategoryPageBody({ slug, lang, zone }: { slug: string; lang: string; zone: string | null }) {
  const data = await loadCategorySlugData(slug, lang, zone);

  // Unresolvable zone -> custom 404 UI, rendered inline (200 status) — same
  // trade-off as before the move to real path segments, not a regression.
  if (data.notFoundPage) {
    return <Custom404 />;
  }

  return (
    <div>
      <LanguageCodesSeed codes={data.langCodes} />
      {data.markUpSchema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: data.markUpSchema }}
        />
      )}
      <CategoriesPages initialCategory={data.initialCategory} />
    </div>
  );
}
