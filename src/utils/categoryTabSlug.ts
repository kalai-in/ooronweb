/**
 * Category-tab slugs for the home page's `?tab=` URL param.
 *
 * The home layout's `category_tabs` entries carry NO slug field — their ids are
 * opaque builder strings ("custom-cat-msehib77-3") that make poor URLs. The only
 * human-readable handle is `name`, so the URL slug is derived from it and
 * resolved back to an id by matching slugified names.
 *
 * Consequence, by design: renaming a tab in the admin builder changes its URL.
 * That is unavoidable until the API exposes a stable per-tab slug; when it does,
 * prefer `tab.slug` here and keep this as the fallback. Because an unmatched
 * slug falls back to the first tab (never a 404), a rename degrades to "shows
 * the default tab" rather than a dead page.
 */

// Home-layout tab entry; the API shape is loosely defined/builder-driven.
type CategoryTab = {
  id?: number | string;
  slug?: string;
  name?: string;
  translations?: { name?: string };
  [key: string]: any;
};

/**
 * "Pharamacy" -> "pharamacy", "Home & Kitchen" -> "home-kitchen".
 * Returns "" for anything unusable so callers can skip it.
 */
export const slugifyTabName = (name?: unknown): string => {
  if (typeof name !== "string") return "";
  return (
    name
      .normalize("NFKD")
      // Strip diacritics so "Café" and "Cafe" produce the same slug.
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .trim()
      // Any run of non-alphanumerics becomes a single hyphen.
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
  );
};

/**
 * The slug for a tab entry. Prefers an API-provided `slug` if one ever appears,
 * so this keeps working unchanged once the backend adds the field.
 */
export const tabSlug = (tab?: CategoryTab | null): string => {
  if (!tab) return "";
  const apiSlug = typeof tab.slug === "string" ? tab.slug.trim() : "";
  if (apiSlug) return slugifyTabName(apiSlug) || "";
  return slugifyTabName(tab?.translations?.name ?? tab?.name);
};

/**
 * Resolve a `?tab=` slug to a tab id.
 *
 * Returns null when the slug is absent or matches nothing — null is exactly the
 * "no tab picked" value the rest of the app already uses, which makes the
 * backend serve its first tab. So a stale or hand-typed slug renders the default
 * home rather than an error.
 *
 * Names are not guaranteed unique; first match wins, matching the strip's own
 * top-to-bottom render order.
 */
export const tabIdFromSlug = (
  tabs?: CategoryTab[] | null,
  slug?: string | null,
): number | string | null => {
  if (!Array.isArray(tabs) || !slug) return null;
  const target = slugifyTabName(slug);
  if (!target) return null;
  const match = tabs.find((tab) => tabSlug(tab) === target);
  return match?.id ?? null;
};

/**
 * Inverse of the above: the slug currently in force, for writing back to the
 * URL. Returns "" for the first tab so the default home stays a clean, canonical
 * "/" with no redundant ?tab= param.
 */
export const slugFromTabId = (
  tabs?: CategoryTab[] | null,
  id?: number | string | null,
): string => {
  if (!Array.isArray(tabs) || tabs.length === 0 || id == null) return "";
  const index = tabs.findIndex((tab) => String(tab?.id) === String(id));
  if (index <= 0) return "";
  return tabSlug(tabs[index]);
};
