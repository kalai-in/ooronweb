import React, { useCallback, useEffect, useState } from "react";
import BreadCrumb from "../breadcrumb/BreadCrumb";
import SellerListingCard from "./SellerListingCard";
import * as api from "@/api/apiRoutes";
import { useDispatch, useSelector } from "react-redux";
import { clearAllFilter } from "@/redux/slices/productFilterSlice";
import { useRouter } from "next/router";
import CardSkeleton from "../skeleton/CardSkeleton";
import { t } from "@/utils/translation";
import useZoneHref from "@/hooks/useZoneHref";
import useUrlProductFilters from "@/hooks/useUrlProductFilters";
const SellerListing = () => {
  const zoneHref = useZoneHref();
  const { buildQueryPatch } = useUrlProductFilters();
  const router = useRouter();
  const dispatch = useDispatch();
  const city = useSelector((state) => state.City.city);

  const [sellers, setSellers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  const handleFetchSellers = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const response = await api.getSellers({
        latitude: city?.latitude,
        longitude: city?.longitude,
      });
      setSellers(response?.data);
    } catch (error) {
      setIsError(true);
      console.log("Error:", error);
    }
    setIsLoading(false);
  }, [city]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount/city change
    handleFetchSellers();
  }, [handleFetchSellers]);

  const handleSellerClick = (seller) => {
    dispatch(clearAllFilter());
    router.push({
      pathname: zoneHref("/products"),
      query: buildQueryPatch({ seller_id: seller?.id }),
    });
  };

  return (
    <section>
      <BreadCrumb />
      <div className="container">
        {isError && !isLoading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <p className="font-semibold text-base fontColor">
              {t("something_went_wrong") || "Something went wrong"}
            </p>
            <button
              type="button"
              onClick={handleFetchSellers}
              className="rounded-lg primaryBackColor py-2 px-5 text-white text-sm font-medium"
            >
              {t("retry") || t("try_again") || "Retry"}
            </button>
          </div>
        ) : (
          <div
            className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 h-auto my-5 px-2`}
          >
            {sellers &&
              sellers?.map((seller) => {
                return (
                  <div
                    key={seller?.id}
                    role="button"
                    tabIndex={0}
                    aria-label={seller?.store_name || seller?.name}
                    className={"col-span-1 cursor-pointer"}
                    onClick={() => handleSellerClick(seller)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSellerClick(seller);
                      }
                    }}
                  >
                    <SellerListingCard seller={seller} />
                  </div>
                );
              })}
            {isLoading &&
              Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx}>
                  <CardSkeleton height={150} />
                </div>
              ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default SellerListing;
