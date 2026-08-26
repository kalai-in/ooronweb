// Turn a category (with its nested `cat_active_childs` tree) into the flat set of
// LEAF/end-level ids the product listing should filter on.
//
// Products live only at leaves. So:
//   - Leaf category (no active children) → filter on that category itself.
//   - Parent category (has children)     → filter on its leaf descendants only.
//     The parent is never a direct product filter, so a parent with no direct
//     products can never yield an empty listing.

const childrenOf = (node) =>
  Array.isArray(node?.cat_active_childs) ? node.cat_active_childs : [];

/**
 * Collect every LEAF descendant under `node` (leaf = no active children) as
 * {id, slug} pairs. If `node` itself is a leaf, returns [{id: node.id, slug:
 * node.slug}]. Deduped by id, order-stable.
 * @returns {Array<{id: number|string, slug: string}>}
 */
export const collectLeafCategoryEntries = (node) => {
  const out = [];
  const seen = new Set();
  const walk = (n) => {
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
 * @returns {Array<number|string>} leaf ids (deduped, order-stable)
 */
export const collectLeafCategoryIds = (node) =>
  collectLeafCategoryEntries(node).map((e) => e.id);

/** Convert resolved ids into the comma-string `category_id` filter format. */
export const toCategoryIdCsv = (ids) =>
  Array.isArray(ids) ? ids.filter((id) => id != null).join(",") : "";

/** Convert resolved {id,slug} entries into a comma-string of slugs. */
export const toCategorySlugCsv = (entries) =>
  Array.isArray(entries)
    ? entries
        .map((e) => e?.slug)
        .filter((slug) => slug != null && slug !== "")
        .join(",")
    : "";
