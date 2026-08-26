import React, { useEffect, useState } from "react";
import BreadCrumb from "../breadcrumb/BreadCrumb";
import * as api from "@/api/apiRoutes";
import { useQuery } from "@tanstack/react-query";
import CategoryPanel from "./CategoryPanel";
import { useRouter } from "next/router";
import { useDispatch, useSelector } from "react-redux";
import {
  setSelectedCategories,
  setListingSource,
  setCategorySlug,
  setCategoryBreadcrumb,
} from "@/redux/slices/productFilterSlice";
import { t } from "@/utils/translation";
import { PackageOpen } from "lucide-react";
import useZoneHref from "@/hooks/useZoneHref";
import useUrlProductFilters from "@/hooks/useUrlProductFilters";

const Category = () => {
  const zoneHref = useZoneHref();
  const { buildQueryPatch } = useUrlProductFilters();
  const dispatch = useDispatch();
  const router = useRouter();
  const { slug } = router.query;
  const language = useSelector((state) => state.Language.selectedLanguage);
  const city = useSelector((state) => state.City);
  const latitude = city?.city?.latitude;
  const longitude = city?.city?.longitude;

  const [page, setPage] = useState(1);
  const [loadedCategories, setLoadedCategories] = useState([]);
  const categoryPerPage = 12;
  const slug_id = slug === "all" ? "" : slug;

  // Reset categories and page when slug or language changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset pagination when slug/language changes
    setPage(1);
    setLoadedCategories([]);
  }, [slug_id, language?.id]);

  const {
    data: categoriesResponse,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["categories", page, slug_id, language?.id, latitude, longitude],
    queryFn: async ({ queryKey }) => {
      const [, page, slug_id] = queryKey;
      const offset = (page - 1) * categoryPerPage;

      // getCategories now requires latitude/longitude.
      return api.getCategories({
        limit: categoryPerPage,
        offset,
        slug: slug_id,
        latitude,
        longitude,
      });
    },
    enabled: latitude != null && longitude != null,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });

  const totalCategories = categoriesResponse?.total || 0;

  // Append new data to loadedCategories when categoriesResponse changes
  useEffect(() => {
    if (categoriesResponse?.data) {
      if (page === 1) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- derives loadedCategories from the react-query response
        setLoadedCategories(categoriesResponse.data);
      } else {
        setLoadedCategories((prev) => {
          const existingIds = new Set(prev.map((c) => c.id));
          const newItems = categoriesResponse.data.filter(
            (c) => !existingIds.has(c.id),
          );
          return [...prev, ...newItems];
        });
      }
    }
  }, [categoriesResponse, page]);

  const categoryBreadcrumb = useSelector(
    (state) => state.ProductFilter.categoryBreadcrumb,
  );

  const handleCategoryClick = (category) => {
    const exists = categoryBreadcrumb.some((c) => c.id === category.id);

    const newBreadcrumb = exists
      ? categoryBreadcrumb
      : [
          ...categoryBreadcrumb,
          {
            id: category.id,
            name: category.translations?.name || category.name,
            slug: category.slug,
          },
        ];

    dispatch(setListingSource({ data: "category" }));
    dispatch(setCategorySlug({ data: category.slug }));
    dispatch(setCategoryBreadcrumb({ data: newBreadcrumb }));
    dispatch(setSelectedCategories({ data: category.id }));
    router.push({
      pathname: zoneHref("/products"),
      query: buildQueryPatch({ category_id: category.slug }),
    });
  };

  useEffect(() => {
    dispatch(setCategoryBreadcrumb({ data: [] }));
  }, [dispatch]);

  const hasMore = loadedCategories.length < totalCategories;

  const handleLoadMore = () => {
    if (!isFetching && hasMore) {
      setPage((prev) => prev + 1);
    }
  };

  const title = categoryBreadcrumb?.find((c) => c.slug === slug)?.name;

  const showingAll = !slug || slug === "all";

  const renderCategoryGrid = () => {
    if (isLoading && loadedCategories.length === 0) {
      return (
        <div className="my-8 grid grid-cols-2 gap-x-3 gap-y-14 pt-10 sm:grid-cols-4 sm:gap-x-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: 12 }).map((_, index) => (
            <PanelSkeleton key={index} />
          ))}
        </div>
      );
    }
    if (loadedCategories.length === 0) {
      return (
        <div className="my-16 flex flex-col items-center justify-center text-center">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl primaryLightBack">
            <PackageOpen className="h-8 w-8 primaryColor" />
          </div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-zinc-100">
            {t("no_categories_found")}
          </h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
            {t("try_again_later")}
          </p>
        </div>
      );
    }
    return (
      <div className="my-8 grid grid-cols-2 gap-x-3 gap-y-14 pt-10 sm:grid-cols-4 sm:gap-x-4 lg:grid-cols-5 xl:grid-cols-6">
        {loadedCategories.map((category, index) => (
          <div
            key={category?.id}
            className="categoryCardIn"
            style={{ "--card-index": index % categoryPerPage }}
          >
            <CategoryPanel category={category} onSelect={handleCategoryClick} />
          </div>
        ))}
        {/* Paging skeleton while fetching the next page */}
        {isFetching &&
          page > 1 &&
          Array.from({ length: 4 }).map((_, i) => (
            <PanelSkeleton key={`sk-${i}`} />
          ))}
      </div>
    );
  };

  return (
    <section className="bodyBackgroundColor min-h-screen">
      <BreadCrumb title={title} />
      <div className="container">
        {/* Page hero */}
        <div className="categoryCardBackground relative mt-6 overflow-hidden rounded-2xl border border-slate-200/70 px-6 py-7 dark:border-zinc-800 sm:px-8 sm:py-8">
          <span className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full primaryLightBack blur-2xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-zinc-50 sm:text-3xl">
                {title || (showingAll ? t("all_categories") : t("categories"))}
              </h1>
              <p className="mt-1.5 max-w-xl text-sm text-slate-500 dark:text-zinc-400">
                {t("browse_categories_subtitle")}
              </p>
            </div>
            {totalCategories > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm font-semibold text-slate-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                <span className="primaryColor">{totalCategories}</span>
                {t("categories")}
              </span>
            )}
          </div>
        </div>

        {/* Initial load / empty state / grid — see renderCategoryGrid */}
        {renderCategoryGrid()}

        {/* Load More */}
        {hasMore && !isLoading && (
          <div className="flex justify-center pb-10">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={isFetching}
              className={`inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold shadow-sm transition-all duration-200 ${
                isFetching
                  ? "cursor-not-allowed border border-slate-200 text-slate-400 dark:border-zinc-700 dark:text-zinc-500"
                  : "primaryBackColor text-white hover:opacity-90 hover:shadow-md active:scale-[0.98]"
              }`}
            >
              {isFetching && (
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
              {isFetching ? t("loading") : t("load_more")}
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

// Skeleton matching the modern image-tile CategoryPanel
const PanelSkeleton = () => (
  <div className="categoryCardBackground relative flex h-28 flex-col items-center justify-center gap-2 rounded-2xl px-3 pb-4 pt-6 shadow-[0_0_20px_rgba(0,0,0,0.1)] dark:shadow-[0_0_20px_rgba(0,0,0,0.5)]">
    <div className="absolute left-1/2 top-0 h-20 w-20 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-slate-200 dark:bg-zinc-800" />
    <div className="mt-8 h-3.5 w-16 animate-pulse rounded bg-slate-200 dark:bg-zinc-800" />
    <div className="h-3 w-12 animate-pulse rounded bg-slate-100 dark:bg-zinc-800/70" />
  </div>
);

export default Category;
