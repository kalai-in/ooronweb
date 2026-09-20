import axios from "axios";
import { extractJSONFromMarkup } from "@/utils/helperFunction";
import { selectSeoRow, pickSeoField } from "@/utils/selectSeoRow";
import { resolveZoneBySlug } from "@/api/zoneResolver";

export type SeoPageData = {
  title: string;
  description: string;
  keywords: string;
  schemaMarkup: string | null;
  ogImage: string;
  favicon: string | null;
};

const defaultSeoData = (): SeoPageData => ({
  title: process.env.NEXT_PUBLIC_META_TITLE || "",
  description: process.env.NEXT_PUBLIC_META_DESCRIPTION || "",
  keywords: process.env.NEXT_PUBLIC_META_KEYWORDS || "",
  schemaMarkup: null,
  ogImage: "",
  favicon: null,
});

/**
 * Fetches the SEO row for one static content page_type (About us, Faqs,
 * Contact us, ...) and shapes it into the props the old getServerSideProps
 * blocks used to return. Shared by every simple content-page route (Batch 2)
 * so the copy-pasted fetch+select+pick logic lives in one place.
 *
 * `zoneId` is optional — pages that are never zone-prefixed (about-us, faqs,
 * contact-us, blogs) omit it and always get the is_default row; pages that
 * ARE zone-aware (privacy-policy, shipping-policy, return-and-exchange-policy,
 * terms-and-conditions, cancellation-policy) pass the resolved zone's id so
 * that zone's own SEO row wins when one exists (see selectSeoRow).
 */
export async function fetchSeoRow(
  pageType: string,
  lang?: string | null,
  zoneId?: number | null,
): Promise<SeoPageData> {
  const defaults = defaultSeoData();
  try {
    const response = await axios.get(
      `${process.env.NEXT_PUBLIC_API_URL}${process.env.NEXT_PUBLIC_API_SUBURL}/settings/get_seo_settings`,
      {
        params: { page_type: pageType },
        headers: { "Content-Language": lang },
      },
    );
    const seo = selectSeoRow(response.data.data, zoneId ?? null);
    if (!seo) return defaults;

    const pick = (key: string) => pickSeoField(seo, key);
    const rawSchema = pick("schema_markup");
    const schemaMarkup = rawSchema ? extractJSONFromMarkup(rawSchema) : null;

    return {
      title: pick("meta_title") || defaults.title,
      description: pick("meta_description") || defaults.description,
      keywords: pick("meta_keyword") || defaults.keywords,
      ogImage: pick("og_image_url") || defaults.ogImage,
      schemaMarkup: schemaMarkup ? JSON.stringify(schemaMarkup) : null,
      favicon: pick("favicon") || defaults.favicon,
    };
  } catch (error) {
    console.log("error", error);
    return defaults;
  }
}

/**
 * Resolves an optional `?zone=` query param (injected by the middleware
 * rewrite) to a zone id for selectSeoRow. An unresolvable zone slug is a
 * dead URL — the caller should 404 rather than silently serve the
 * is_default row under a zone-prefixed URL. Shared by the zone-aware content
 * pages (privacy-policy, shipping-policy, return-and-exchange-policy,
 * terms-and-conditions, cancellation-policy).
 */
export async function resolveZoneForSeo(
  zoneSlug?: string | null,
): Promise<{ zoneId: number | null; notFound: boolean }> {
  if (!zoneSlug) return { zoneId: null, notFound: false };
  const resolved = await resolveZoneBySlug(zoneSlug);
  if (!resolved) return { zoneId: null, notFound: true };
  return { zoneId: resolved.zone?.id ?? null, notFound: false };
}
