// Resolves category slugs <-> ids against an already-fetched full category
// tree (array of top-level nodes, each with nested cat_active_childs). The
// categories API has no direct slug/id lookup endpoint — ?slug=X returns X's
// CHILDREN (empty/not-found for a leaf), ?id=X is ignored — so the only way
// to map an arbitrary node is to walk the full tree client/server-side.
//
// Slug uniqueness confirmed live across the full tree (145 nodes, 0 dupes) —
// first-match-by-slug is safe.
import {
  collectLeafCategoryEntries,
  type CategoryNode,
} from "@/utils/categoryTree";

const childrenOf = (node?: CategoryNode | null): CategoryNode[] =>
  Array.isArray(node?.cat_active_childs) ? node.cat_active_childs : [];

const findNode = (
  tree: CategoryNode[] | null | undefined,
  predicate: (node: CategoryNode) => boolean,
): CategoryNode | null => {
  const stack = [...(Array.isArray(tree) ? tree : [])];
  while (stack.length) {
    const node = stack.pop();
    if (!node) continue;
    if (predicate(node)) return node;
    stack.push(...childrenOf(node));
  }
  return null;
};

export const findNodeBySlug = (
  tree: CategoryNode[] | null | undefined,
  slug?: string | null,
): CategoryNode | null =>
  slug ? findNode(tree, (n) => n?.slug === slug) : null;

export const findNodeById = (
  tree: CategoryNode[] | null | undefined,
  id?: number | string | null,
): CategoryNode | null =>
  id != null ? findNode(tree, (n) => String(n?.id) === String(id)) : null;

/**
 * Resolve a comma-separated list of leaf slugs (from the URL) to a
 * comma-separated list of numeric leaf ids (for the products API). A slug
 * that doesn't exist in the tree is dropped, not thrown — a stale/broken
 * shared link degrades to fewer/no category filters rather than crashing.
 * A slug that resolves to a PARENT (has children) is defensively expanded to
 * its own leaf descendants.
 */
export const resolveSlugCsvToIdCsv = (
  tree: CategoryNode[] | null | undefined,
  slugCsv?: string | null,
): string => {
  if (!slugCsv) return "";
  const slugs = String(slugCsv)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const ids: (number | string)[] = [];
  const seen = new Set<number | string>();
  for (const slug of slugs) {
    const node = findNodeBySlug(tree, slug);
    if (!node) continue;
    const leafEntries =
      childrenOf(node).length > 0
        ? collectLeafCategoryEntries(node)
        : [{ id: node.id, slug: node.slug }];
    for (const entry of leafEntries) {
      if (entry.id != null && !seen.has(entry.id)) {
        seen.add(entry.id);
        ids.push(entry.id);
      }
    }
  }
  return ids.join(",");
};

/**
 * Resolve a comma-separated list of ids to their own slugs (used by
 * click-through sites that only have a raw CMS-configured id, no slug of
 * their own, to build a URL-ready slug CSV). Ids that don't resolve are
 * dropped.
 */
export const resolveIdCsvToSlugCsv = (
  tree: CategoryNode[] | null | undefined,
  idCsv?: string | null,
): string => {
  if (!idCsv) return "";
  const ids = String(idCsv)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const slugs: string[] = [];
  for (const id of ids) {
    const node = findNodeById(tree, id);
    if (node?.slug) slugs.push(node.slug);
  }
  return slugs.join(",");
};
