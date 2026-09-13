import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "@/api/apiRoutes";

// Fetches the FULL category tree (no slug/id param -> every top-level
// category with its nested cat_active_childs, each carrying id+slug) once
// per session and caches it — used to resolve category slugs <-> ids for the
// URL (see src/utils/categorySlugResolver.js). Same cache window as the
// existing per-category childCategories query in ProductsList.jsx.
interface UseFullCategoryTreeOptions {
  latitude?: number | string;
  longitude?: number | string;
  languageId?: number | string;
}

export default function useFullCategoryTree({
  latitude,
  longitude,
  languageId,
}: UseFullCategoryTreeOptions = {}) {
  // latitude/longitude/languageId each settle through more than one value
  // while zone/language resolution completes (see Header.jsx's fetchCity and
  // Layout.jsx's fetchLanguage) — debounce so the query key change collapses
  // to the final values instead of fetching once per intermediate one.
  const [debounced, setDebounced] = useState({ latitude, longitude, languageId });
  useEffect(() => {
    const id = setTimeout(
      () => setDebounced({ latitude, longitude, languageId }),
      300,
    );
    return () => clearTimeout(id);
  }, [latitude, longitude, languageId]);

  const queryClient = useQueryClient();
  const queryKey = [
    "fullCategoryTree",
    debounced.languageId,
    debounced.latitude,
    debounced.longitude,
  ];
  const queryFn = async () => {
    const res: any = await api.getCategories({
      latitude: debounced.latitude,
      longitude: debounced.longitude,
    });
    return Array.isArray(res?.data) ? res.data : [];
  };

  const query = useQuery({
    queryKey,
    queryFn,
    enabled: debounced.latitude != null && debounced.longitude != null,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });

  // For callers that need the tree at a specific moment (e.g. a click handler
  // resolving a category id to its slug) rather than reactively — awaits the
  // in-flight/cached query instead of racing it. Resolves to [] if location
  // isn't known yet (same guard as `enabled` above).
  const resolveCategoryTree = async (): Promise<any[]> => {
    if (debounced.latitude == null || debounced.longitude == null) return [];
    return queryClient.fetchQuery({
      queryKey,
      queryFn,
      staleTime: 1000 * 60 * 5,
    });
  };

  return { ...query, resolveCategoryTree };
}
