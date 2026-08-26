import React, { useState, useEffect, useCallback } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";

// Category picker tree.
//
// Selection model — LEAVES ONLY. `selectedCategories` holds only end-level (leaf)
// category ids; parents are never stored. A parent's checkbox state is DERIVED
// from its leaf descendants:
//   all leaves selected  → checked
//   some leaves selected → indeterminate
//   no leaves selected   → unchecked
// Toggling a parent selects/clears ALL its leaf descendants. Unchecking the last
// child empties the selection → the listing falls back to all products.
const CategoryTree = ({
  categories,
  selectedCategories,
  onCategoryChange,
  initialFilter,
}) => {
  const [treeData, setTreeData] = useState([]);
  const [expandedKeys, setExpandedKeys] = useState([]);

  // Transform categories into tree structure. `slug` rides alongside `key`
  // (id) — the tree's own selection logic stays id-based throughout (tri-state
  // math, expand/collapse, selectedCategories), slug is only surfaced via
  // onCategoryChange's second argument for the parent to build the URL with.
  const transformCategoryData = useCallback((categories) => {
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
    const ancestors = [];
    const hasSelectedDescendant = (node) => {
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
    (keys) => {
      const wanted = new Set(keys.map(String));
      const out = [];
      const walk = (node) => {
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
    const slugs = entriesForKeys(catNum)
      .map((e) => e.slug)
      .filter(Boolean);
    onCategoryChange(catNum, slugs);
    // onCategoryChange (handleCategoryChange in ProductFilter.jsx) is a plain
    // function recreated every parent render, not memoized — adding it here
    // would rerun this effect on unrelated parent rerenders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFilter, treeData, entriesForKeys]);

  const handleExpandCollapse = (nodeKey) => {
    setExpandedKeys((prev) =>
      prev.includes(nodeKey)
        ? prev.filter((key) => key !== nodeKey)
        : [...prev, nodeKey],
    );
  };

  // Every LEAF id at or under a node. For a leaf node → [itself]. Drives both the
  // derived parent state and the parent toggle.
  const getLeafKeys = (node) => {
    if (!node.children?.length) return [node.key];
    return node.children.flatMap((child) => getLeafKeys(child));
  };

  const selectedSet = new Set(selectedCategories.map((k) => String(k)));

  // Tri-state for any node from its leaf descendants:
  //   "checked" | "indeterminate" | "unchecked"
  const getNodeState = (node) => {
    const leaves = getLeafKeys(node);
    const selectedCount = leaves.filter((k) =>
      selectedSet.has(String(k)),
    ).length;
    if (selectedCount === 0) return "unchecked";
    if (selectedCount === leaves.length) return "checked";
    return "indeterminate";
  };

  // Toggle a node: add/remove ALL its leaf descendants (a leaf toggles itself).
  // checked/indeterminate → clear its leaves; unchecked → add its leaves.
  const toggleNode = (node) => {
    const leaves = getLeafKeys(node);
    const shouldSelect = getNodeState(node) === "unchecked";
    const next = new Set(selectedCategories);
    leaves.forEach((k) => {
      if (shouldSelect) next.add(k);
      else next.delete(k);
    });
    const nextIds = [...next];
    const nextSlugs = entriesForKeys(nextIds)
      .map((e) => e.slug)
      .filter(Boolean);
    onCategoryChange(nextIds, nextSlugs);
  };

  // Recursive component to render tree nodes
  const TreeNode = ({ node }) => {
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
            onClick={() => toggleNode(node)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleNode(node);
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
              <TreeNode key={child.key} node={child} />
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
