"use client";
import React from "react";
import { t } from "@/utils/translation";
import { useSelector } from "react-redux";
import { usePathname, useRouter } from "next/navigation";
import SearchProductCard from "../cards/SearchProductCard";
import { IoSearchOutline } from "react-icons/io5";
import ThemedSvg from "@/components/notfound/ThemedSvg";
import NoSearchImage from "@/assets/empty-state/no-search.svg";
import useZoneHref from "@/hooks/useZoneHref";
import useSearchPlaceholder from "@/hooks/useSearchPlaceholder";
import useIsHydrated from "@/hooks/useIsHydrated";

interface SearchComponentProps {
  handleSearch: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isSuggLoading?: boolean;
  isSuggError?: boolean;
  onRetrySearch?: () => void;
  searchText?: string;
  isMobile?: boolean;
  mobileSearch?: boolean;
  setMobileSearch?: (open: boolean) => void;
  onResultClick?: () => void;
}

const SearchComponent = ({ handleSearch, isSuggLoading, isSuggError, onRetrySearch, searchText = "", onResultClick }: SearchComponentProps) => {
  const zoneHref = useZoneHref();
  const router = useRouter();
  const pathname = usePathname();
  // search_product (suggestion dropdown results) is cached API response data,
  // not a filter value — stays in redux. The typed text itself is owned by
  // Header.jsx (local state, URL-synced only on /products) and passed in.
  const searchProduct = useSelector((state: any) => state.ProductFilter.search_product);
  // Rotates through the zone's search_suggestions; freezes once the user starts
  // typing so the placeholder isn't moving under a half-entered query.
  const { suggestion, index: suggestionIndex, hasSuggestions } =
    useSearchPlaceholder({ active: !searchText });
  // `hasSuggestions` derives from persisted ShopMode.searchSuggestions — empty on
  // the server, populated on the first client paint. Gating the overlay on it
  // directly flips both the input's `placeholder` and the hint <div>'s presence
  // between server and client, discarding the tree (hydration error #418). Hold
  // the overlay off until hydrated so the first client render matches the server
  // (static placeholder, no hint); the animation lands on the next render.
  const hydrated = useIsHydrated();
  // The animated overlay only shows while the field is empty — once there's a
  // value, the real input text takes over.
  const showAnimatedHint = hydrated && hasSuggestions && !searchText;

  const handleSearchItemClick = async () => {
    // No redux to reset — router.push to a bare /products (no query) is
    // naturally clean of any stale category filter.
    router.push(zoneHref("/products"));
  };

  // Skeleton row mirrors SearchProductCard layout (40px thumb + two text lines)
  // so the dropdown doesn't flash empty / half-rendered while suggestions load.
  const SkeletonRow = () => (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 dark:border-zinc-800/80 last:border-b-0">
      <div className="w-10 h-10 flex-shrink-0 rounded-md bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
      <div className="flex flex-col flex-grow gap-2 min-w-0">
        <div className="h-3 w-3/4 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
        <div className="h-3 w-1/4 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
      </div>
    </div>
  );

  return (
    <div className="relative w-full">
      <div className={`flex w-full h-[44px] lg:h-[48px] items-center bg-gray-100 dark:bg-zinc-800 rounded-lg px-4 gap-2.5`}>
        <IoSearchOutline size={17} className="flex-shrink-0 text-zinc-400 dark:text-zinc-500" />
        {/* Blinkit-style animated hint. A native `placeholder` can't animate, so
            while suggestions exist the input's own placeholder is suppressed and
            this overlay renders instead: the prompt stays fixed, only the product
            name slides up and out. pointer-events-none keeps clicks/taps landing
            on the input underneath. */}
        <div className="relative flex-1 min-w-0 h-full">
          <input
            type="text"
            aria-label={hydrated ? t("search") : "search"}
            placeholder={
              showAnimatedHint ? "" : hydrated ? t("iAmLookingFor") : ""
            }
            className="w-full h-full text-sm focus:outline-none bg-transparent text-zinc-800 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 border-none shadow-none min-w-0"
            value={searchText}
            onChange={(e) => handleSearch(e)}
            onKeyDown={(e) => e.key === "Enter" && handleSearchItemClick()}
          />
          {showAnimatedHint && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex items-center gap-1.5 text-sm text-zinc-400 dark:text-zinc-500"
            >
              <span className="flex-shrink-0">{t("iAmLookingFor")}</span>
              {/* Fixed-height clip: the outgoing name slides up out of view as
                  the incoming one rises into it. */}
              <span className="relative flex-1 min-w-0 h-5 overflow-hidden">
                {/* CSS-only replacement for the old framer-motion cross-fade —
                    same visual (slide up + fade in), but the whole library
                    (~130KB) doesn't need to ship just for this one hint
                    animation. Remounting on key change restarts the CSS
                    animation, same trigger framer-motion's AnimatePresence used. */}
                <span
                  key={suggestionIndex}
                  className="search-hint-slide absolute inset-0 flex items-center font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap overflow-hidden text-ellipsis"
                >
                  {suggestion}
                </span>
              </span>
            </div>
          )}
        </div>
      </div>

      {pathname !== "/products" && searchText && (
        <div className="w-full mt-2 flex flex-col bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800/80 rounded-2xl shadow-xl shadow-zinc-200/40 dark:shadow-none absolute z-[60] top-full left-0 right-0 max-h-[360px] overflow-y-auto p-1.5">
          {!isSuggLoading && isSuggError ? (
            <div className="flex flex-col items-center justify-center gap-2.5 py-6 text-center">
              <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">
                {t("something_went_wrong") || "Something went wrong"}
              </span>
              <button
                type="button"
                onClick={onRetrySearch}
                className="rounded-lg primaryBackColor py-1.5 px-4 text-white text-xs font-medium"
              >
                {t("retry") || t("try_again") || "Retry"}
              </button>
            </div>
          ) : isSuggLoading && searchProduct?.length === 0 ? (
            Array.from({ length: 4 }).map((_, idx) => <SkeletonRow key={idx} />)
          ) : (
            <>
              {searchProduct?.map((product: any, idx: number) => (
                <SearchProductCard key={idx} product={product} onResultClick={onResultClick} />
              ))}
              {!isSuggLoading && searchProduct?.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
                  <ThemedSvg
                    src={NoSearchImage}
                    alt={t("no_product_found")}
                    className="w-32 max-w-[140px]"
                  />
                  <span className="text-sm font-semibold text-zinc-400 dark:text-zinc-500">
                    {t("no_product_found")}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchComponent;
