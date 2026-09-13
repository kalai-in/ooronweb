// Turn a category (with its nested `cat_active_childs` tree) into the flat set of
// LEAF/end-level ids the product listing should filter on.
//
// Products live only at leaves. So:
//   - Leaf category (no active children) → filter on that category itself.
//   - Parent category (has children)     → filter on its leaf descendants only.
//     The parent is never a direct product filter, so a parent with no direct
//     products can never yield an empty listing.

// Category node shape is deeply nested/API-driven; kept loose on purpose.
export type CategoryNode = {
  id?: number | string;
  slug?: string;
  cat_active_childs?: CategoryNode[];
  [key: string]: any;
};

export type LeafCategoryEntry = { id?: number | string; slug?: string };

const childrenOf = (node?: CategoryNode | null): CategoryNode[] =>
  Array.isArray(node?.cat_active_childs) ? node.cat_active_childs : [];

/**
 * Collect every LEAF descendant under `node` (leaf = no active children) as
 * {id, slug} pairs. If `node` itself is a leaf, returns [{id: node.id, slug:
 * node.slug}]. Deduped by id, order-stable.
 */
export const collectLeafCategoryEntries = (
  node?: CategoryNode | null,
): LeafCategoryEntry[] => {
  const out: LeafCategoryEntry[] = [];
  const seen = new Set<number | string>();
  const walk = (n?: CategoryNode | null) => {
    const kids = childrenOf(n);
    if (kids.length === 0) {
      if (n?.id != null && !seen.has(n.id)) {
        seen.add(n.id);
        out.push({ id: n.id, slug: n.slug });
      }
      return;
    }
    kids.forEach(walk);
  };
  walk(node);
  return out;
};

/**
 * Collect the ids of every LEAF descendant under `node`.
 * Returns leaf ids (deduped, order-stable).
 */
export const collectLeafCategoryIds = (
  node?: CategoryNode | null,
): (number | string | undefined)[] =>
  collectLeafCategoryEntries(node).map((e) => e.id);

/** Convert resolved ids into the comma-string `category_id` filter format. */
export const toCategoryIdCsv = (
  ids?: (number | string | null | undefined)[] | null,
): string =>
  Array.isArray(ids) ? ids.filter((id) => id != null).join(",") : "";

/** Convert resolved {id,slug} entries into a comma-string of slugs. */
export const toCategorySlugCsv = (
  entries?: LeafCategoryEntry[] | null,
): string =>
  Array.isArray(entries)
    ? entries
        .map((e) => e?.slug)
        .filter((slug) => slug != null && slug !== "")
        .join(",")
    : "";
