import React, { useState, useEffect, useCallback } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";

interface CategoryTreeNode {
  title: string;
  key: number | string;
  slug: string;
  children: CategoryTreeNode[];
}

interface CategoryTreeInitialFilter {
  category_id?: string | number | null;
}

interface CategoryTreeProps {
  /** Category rows, raw API shape. */
  categories: any[];
  selectedCategories: (number | string)[];
  onCategoryChange: (categoryIds: (number | string)[], slugs: string[]) => void;
  initialFilter?: CategoryTreeInitialFilter;
}

// Category picker tree.
//
// Selection model — LEAVES ONLY. `selectedCategories` holds only end-level (leaf)
// category ids; parents are never stored. A parent's checkbox state is DERIVED
// from its leaf descendants:
//   all leaves selected  → checked
//   some leaves selected → indeterminate
//   no leaves selected   → unchecked
//
// Parent click: unchecked OR indeterminate → select ALL its leaves; checked →
// deselect ALL its leaves. Only this parent's own leaves are touched — any
// selection belonging to a different branch of the tree is untouched.
//
// Leaf click depends on the HIGHEST fully-"checked" ancestor at click time —
// not just the immediate parent. Clicking Women selects every leaf under
// Women (Clothes, Footwear, Handbags, Jewellery, …), so Women itself (and
// every intermediate ancestor) reads as "checked". Clicking a single leaf
// (Dupattas) after that must isolate it across the WHOLE selected subtree,
// not just its immediate parent (Clothes) — otherwise Footwear/Handbags/
// Jewellery are left fully selected while only Clothes' siblings get cleared.
//   - walk the leaf's ancestor chain (root-first) and take the OUTERMOST
//     ancestor whose derived state is "checked"; if none is fully checked,
//     there's no isolate case.
//   - found one → CONVERT: clear every leaf under that outermost ancestor,
//     then select only the clicked leaf. Selections outside that ancestor's
//     subtree are untouched. The ancestor (and everything below it down to
//     the clicked leaf) naturally falls to indeterminate.
//   - none found (leaf/ancestors are indeterminate or unchecked) → plain
//     additive toggle: add the leaf if unselected, remove it if selected.
//     Siblings, and everything else, are left exactly as they were.
// Re-clicking an already-selected leaf (outside the isolate case) always just
// removes that one leaf.
const CategoryTree = ({
  categories,
  selectedCategories,
  onCategoryChange,
  initialFilter,
}: CategoryTreeProps) => {
  const [treeData, setTreeData] = useState<CategoryTreeNode[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<(number | string)[]>([]);

  // Transform categories into tree structure. `slug` rides alongside `key`
  // (id) — the tree's own selection logic stays id-based throughout (tri-state
  // math, expand/collapse, selectedCategories), slug is only surfaced via
  // onCategoryChange's second argument for the parent to build the URL with.
  const transformCategoryData = useCallback((categories: any[]): CategoryTreeNode[] => {
    return categories?.map((category) => ({
      title: category?.translations?.name ?? category?.name,
      key: category.id,
      slug: category.slug,
      children:
        category.cat_active_childs?.length > 0
          ? transformCategoryData(category.cat_active_childs)
          : [],
    }));
  }, []);

  // Initialize tree data when categories change
  useEffect(() => {
    if (categories?.length > 0) {
      const transformedData = transformCategoryData(categories);
      setTreeData(transformedData);
    }
  }, [categories, transformCategoryData]);

  // Auto-expand the ancestor path of any selected leaf so a deeply-nested
  // selection is visible (otherwise it stays hidden inside collapsed parents).
  useEffect(() => {
    if (!treeData.length || !selectedCategories?.length) return;
    const selectedSet = new Set(selectedCategories.map((k) => String(k)));
    const ancestors: (number | string)[] = [];
    const hasSelectedDescendant = (node: CategoryTreeNode): boolean => {
      let found = selectedSet.has(String(node.key));
      (node.children || []).forEach((child) => {
        if (hasSelectedDescendant(child)) found = true;
      });
      if (found && node.children?.length) ancestors.push(node.key);
      return found;
    };
    treeData.forEach(hasSelectedDescendant);
    if (ancestors.length) {
      setExpandedKeys((prev) => [...new Set([...prev, ...ancestors])]);
    }
  }, [treeData, selectedCategories]);

  // Find every {key, slug} entry in treeData whose key is in `keys`.
  const entriesForKeys = useCallback(
    (keys: (number | string)[]) => {
      const wanted = new Set(keys.map(String));
      const out: { key: number | string; slug: string }[] = [];
      const walk = (node: CategoryTreeNode) => {
        if (wanted.has(String(node.key)))
          out.push({ key: node.key, slug: node.slug });
        (node.children || []).forEach(walk);
      };
      treeData.forEach(walk);
      return out;
    },
    [treeData],
  );

  // Initialize selected categories from filter (the resolved leaf ids the
  // parent computed from the URL's slug csv — see ProductFilter.jsx). Waits
  // for treeData so the slug lookup below (entriesForKeys) has real nodes to
  // search; without this gate it would fire with slug: undefined for every
  // entry on the render where initialFilter arrives before the tree does.
  useEffect(() => {
    if (
      !treeData.length ||
      initialFilter?.category_id == null ||
      initialFilter?.category_id === ""
    ) {
      return;
    }
    // category_id may be a number (single leaf) or a comma-string (multi leaf).
    const catNum = String(initialFilter.category_id)
      .split(",")
      .filter((cat) => cat !== "")
      .map((cat) => parseInt(cat));
    const entries = entriesForKeys(catNum);
    // treeData here comes from a category-CONTEXT-scoped tree (e.g.
    // categoryFilters.child_categories), which refetches on its own timing —
    // separate from whatever resolved initialFilter.category_id (the full
    // category tree, resolved elsewhere). If THIS tree hasn't caught up yet
    // for a brand new category, none of catNum's ids exist in it, so
    // entries comes back empty even though catNum is real and non-empty.
    // That is a "this tree isn't ready" state, not "nothing is selected" —
    // firing onCategoryChange(catNum, []) here would write an EMPTY
    // category_id to the URL and silently wipe out the real selection.
    // Wait for this tree to actually catch up instead.
    if (catNum.length > 0 && entries.length === 0) return;
    const slugs = entries.map((e) => e.slug).filter(Boolean);
    onCategoryChange(catNum, slugs);
    // onCategoryChange (handleCategoryChange in ProductFilter.jsx) is a plain
    // function recreated every parent render, not memoized — adding it here
    // would rerun this effect on unrelated parent rerenders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFilter, treeData, entriesForKeys]);

  const handleExpandCollapse = (nodeKey: number | string) => {
    setExpandedKeys((prev) =>
      prev.includes(nodeKey)
        ? prev.filter((key) => key !== nodeKey)
        : [...prev, nodeKey],
    );
  };

  // Every LEAF id at or under a node. For a leaf node → [itself]. Drives both the
  // derived parent state and the parent toggle.
  const getLeafKeys = (node: CategoryTreeNode): (number | string)[] => {
    if (!node.children?.length) return [node.key];
    return node.children.flatMap((child) => getLeafKeys(child));
  };

  const selectedSet = new Set(selectedCategories.map((k) => String(k)));

  // Tri-state for any node from its leaf descendants:
  //   "checked" | "indeterminate" | "unchecked"
  const getNodeState = (node: CategoryTreeNode): "checked" | "indeterminate" | "unchecked" => {
    const leaves = getLeafKeys(node);
    const selectedCount = leaves.filter((k) =>
      selectedSet.has(String(k)),
    ).length;
    if (selectedCount === 0) return "unchecked";
    if (selectedCount === leaves.length) return "checked";
    return "indeterminate";
  };

  // Toggle a node. `ancestors` is the root-first chain of ancestor nodes
  // (empty for a top-level node) — needed to find the OUTERMOST fully-
  // selected ancestor for the leaf "isolate across the whole selected
  // subtree" rule (see the model comment above).
  const toggleNode = (node: CategoryTreeNode, ancestors: CategoryTreeNode[] = []) => {
    const leaves = getLeafKeys(node);
    const isLeaf = leaves.length === 1 && leaves[0] === node.key;

    let nextIds: (number | string)[];

    if (isLeaf) {
      const isSelected = selectedSet.has(String(node.key));
      // Root-first: the FIRST ancestor found fully checked is the outermost
      // one, since a descendant can only be fully checked if every ancestor
      // above it is too (checked-ness only weakens going down, never
      // strengthens) — so this is exactly the "highest relevant selected
      // ancestor" the isolate rule needs.
      const outermostCheckedAncestor = ancestors.find(
        (a) => getNodeState(a) === "checked",
      );

      if (outermostCheckedAncestor) {
        // Found a fully-selected ancestor — isolate the clicked leaf across
        // that ENTIRE subtree: clear every leaf under it, then select only
        // the clicked leaf. Selections outside that ancestor's subtree are
        // untouched. The ancestor (and every node between it and the clicked
        // leaf) naturally falls to indeterminate from the derived state.
        const subtreeLeaves = getLeafKeys(outermostCheckedAncestor);
        const subtreeSet = new Set(subtreeLeaves.map(String));
        const next = selectedCategories.filter(
          (k) => !subtreeSet.has(String(k)),
        );
        next.push(node.key);
        nextIds = next;
      } else if (isSelected) {
        // Plain removal — only this leaf, siblings and everything else stay.
        nextIds = selectedCategories.filter((k) => String(k) !== String(node.key));
      } else {
        // Plain addition — only this leaf, siblings and everything else stay.
        nextIds = [...selectedCategories, node.key];
      }
    } else {
      // Parent click: unchecked/indeterminate → select all its leaves;
      // checked → deselect all its leaves. Only this node's own leaves.
      const shouldSelect = getNodeState(node) !== "checked";
      const next = new Set(selectedCategories);
      leaves.forEach((k) => {
        if (shouldSelect) next.add(k);
        else next.delete(k);
      });
      nextIds = [...next];
    }

    const nextSlugs = entriesForKeys(nextIds)
      .map((e) => e.slug)
      .filter(Boolean);
    onCategoryChange(nextIds, nextSlugs);
  };

  // Recursive component to render tree nodes. `ancestors` (empty at the top
  // level) is the root-first chain of ancestor nodes, passed down so
  // toggleNode can find the outermost fully-selected ancestor on a leaf click.
  const TreeNode = ({
    node,
    ancestors = [],
  }: {
    node: CategoryTreeNode;
    ancestors?: CategoryTreeNode[];
  }) => {
    const isExpanded = expandedKeys.includes(node.key);
    const hasChildren = node.children?.length > 0;
    const state = getNodeState(node);

    return (
      <div className="ml-1 md:ml-1.5 lg:ml-4">
        <div className="flex items-center my-2.5 gap-2">
          {/* Expand/Collapse Arrow */}
          <div className="w-4 h-4 flex-shrink-0 flex items-center justify-center">
            {hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleExpandCollapse(node.key);
                }}
                className="focus:outline-none flex items-center justify-center"
              >
                {isExpanded ? (
                  <ChevronDown
                    className={`h-4 w-4 ${state !== "unchecked" ? "primaryColor" : "text-gray-500"}`}
                  />
                ) : (
                  <ChevronRight className="h-4 w-4 text-gray-500" />
                )}
              </button>
            )}
          </div>

          <div
            role="checkbox"
            tabIndex={0}
            aria-checked={
              state === "indeterminate" ? "mixed" : state === "checked"
            }
            aria-label={node.title}
            className="flex items-center gap-2 cursor-pointer flex-grow min-w-0"
            onClick={() => toggleNode(node, ancestors)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleNode(node, ancestors);
              }
            }}
          >
            <span
              className={`text-[15px] text-ellipsis truncate ${
                state !== "unchecked"
                  ? "primaryColor font-medium"
                  : "text-gray-600 hover:text-black"
              }`}
            >
              {node.title}
            </span>
          </div>
        </div>
        {hasChildren && isExpanded && (
          <div>
            {node.children.map((child) => (
              <TreeNode
                key={child.key}
                node={child}
                ancestors={[...ancestors, node]}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="overflow-y-auto px-2 pb-4 md:px-2 lg:px-4">
      {treeData.map((node) => (
        <TreeNode key={node.key} node={node} />
      ))}
    </div>
  );
};

export default CategoryTree;
