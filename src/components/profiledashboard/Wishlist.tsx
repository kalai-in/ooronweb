import { useCallback, useEffect, useState } from "react";
import { t } from "@/utils/translation";
import * as api from "@/api/apiRoutes";
import { useSelector } from "react-redux";
import WishlistCard from "../productcards/WishlistCard";
import CardSkeleton from "../skeleton/CardSkeleton";
import NoWishListImage from "@/assets/empty-state/empty-whistlist.svg";
import NotFound from "../notfound/NotFound";

const Wishlist = () => {
  const lat = useSelector((state: any) => state.City.city?.latitude);
  const lng = useSelector((state: any) => state.City.city?.longitude);
  // Wishlist product entries come straight from the getFavorite API response
  // (raw JSON shape) — `any` here matches the API-boundary policy.
  const [wishlistProducts, setWishlistProducts] = useState<any[]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [isError, setIsError] = useState(false);

  const itemPerPage = 10;

  // `fetchOffset` is passed explicitly so load-more never reads a stale offset
  // from state. `isAppend` keeps the existing list visible (only the load-more
  // spinner shows) instead of flashing the whole grid back to skeletons.
  const handleFetchLikedProducts = useCallback(
    async ({
      fetchOffset = 0,
      isAppend = false,
    }: { fetchOffset?: number; isAppend?: boolean } = {}) => {
      if (isAppend) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setIsError(false);
      }
      try {
        const response = await api.getFavorite({
          latitude: lat,
          longitude: lng,
          limit: itemPerPage,
          offset: fetchOffset,
        });
        if (response.status == 1) {
          setWishlistProducts((prev) =>
            isAppend ? [...prev, ...response.data] : response.data,
          );
          setTotal(response.total);
        } else if (!isAppend) {
          setWishlistProducts([]);
          setTotal(0);
        }
      } catch (error) {
        if (!isAppend) {
          setIsError(true);
        }
        console.log("Error", error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [lat, lng, itemPerPage],
  );

  useEffect(() => {
    // Reset to first page whenever the city (delivery location) changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-dependency-change pattern; not derivable from render
    handleFetchLikedProducts({ fetchOffset: 0, isAppend: false });
    setOffset(0);
  }, [lat, lng, handleFetchLikedProducts]);

  const handleLoadMore = () => {
    const nextOffset = offset + itemPerPage;
    setOffset(nextOffset);
    handleFetchLikedProducts({ fetchOffset: nextOffset, isAppend: true });
  };

  return (
    <div className="w-full cardBorder rounded-2xl overflow-hidden">
      <div className="backgroundColor flex justify-between px-4 sm:px-5 py-4 items-center border-b">
        <h2 className="font-bold text-lg sm:text-xl">{t("wishlist")}</h2>
        {!loading && wishlistProducts?.length > 0 && (
          <span className="SecondaryTextColor text-sm font-medium">
            {total ?? wishlistProducts?.length} {t("items") || "items"}
          </span>
        )}
      </div>
      <div className="p-3 sm:p-4">
        {loading ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5 sm:gap-3">
            {Array?.from({ length: 8 })?.map((_, index) => (
              <CardSkeleton height={104} padding="3px" key={index} />
            ))}
          </div>
        ) : isError ? (
          <div className="grid place-items-center gap-3 py-10 text-center">
            <p className="font-semibold text-base fontColor">
              {t("something_went_wrong") || "Something went wrong"}
            </p>
            <button
              className="rounded-lg primaryBackColor py-2 px-5 text-white text-sm font-medium"
              onClick={() =>
                handleFetchLikedProducts({ fetchOffset: 0, isAppend: false })
              }
            >
              {t("retry") || t("try_again") || "Retry"}
            </button>
          </div>
        ) : wishlistProducts?.length > 0 ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-2.5 sm:gap-3">
            {wishlistProducts?.map((prdct) => (
              <WishlistCard
                key={prdct?.id}
                product={prdct}
                setWishlistProducts={setWishlistProducts}
                wishlistProducts={wishlistProducts}
                setTotal={setTotal}
                handleFetchLikedProducts={handleFetchLikedProducts}
              />
            ))}

            {loadingMore &&
              Array?.from({ length: 4 })?.map((_, index) => (
                <CardSkeleton
                  height={104}
                  padding="3px"
                  key={`more-${index}`}
                />
              ))}
          </div>
        ) : (
          <NotFound
            image={NoWishListImage}
            title={t("enter_wishlist_message")}
            className="col-span-12"
          />
        )}

        {!loading && (total ?? 0) > (wishlistProducts?.length ?? 0) && (
          <div className="flex justify-center mt-5">
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="primaryBackColor text-white py-2.5 px-8 rounded-xl text-sm sm:text-base font-semibold hover:opacity-90 disabled:opacity-60 transition shadow-sm"
            >
              {loadingMore ? t("loading") : t("load_more")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Wishlist;
