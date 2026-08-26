import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as api from "@/api/apiRoutes";

// Fetches the FULL category tree (no slug/id param -> every top-level
// category with its nested cat_active_childs, each carrying id+slug) once
// per session and caches it — used to resolve category slugs <-> ids for the
// URL (see src/utils/categorySlugResolver.js). Same cache window as the
// existing per-category childCategories query in ProductsList.jsx.
export default function useFullCategoryTree({
  latitude,
  longitude,
  languageId,
} = {}) {
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

  return useQuery({
    queryKey: [
      "fullCategoryTree",
      debounced.languageId,
      debounced.latitude,
      debounced.longitude,
    ],
    queryFn: async () => {
      const res = await api.getCategories({
        latitude: debounced.latitude,
        longitude: debounced.longitude,
      });
      return Array.isArray(res?.data) ? res.data : [];
    },
    enabled: debounced.latitude != null && debounced.longitude != null,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });
}
