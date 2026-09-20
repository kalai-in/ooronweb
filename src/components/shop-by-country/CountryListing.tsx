"use client";

import React, { useCallback, useEffect, useState } from "react";
import BreadCrumb from "../breadcrumb/BreadCrumb";
import * as api from "@/api/apiRoutes";
import { useDispatch, useSelector } from "react-redux";
import { clearAllFilter } from "@/redux/slices/productFilterSlice";
import { useRouter } from "next/navigation";
import Country from "./Country";
import CardSkeleton from "../skeleton/CardSkeleton";
import { t } from "@/utils/translation";
import useZoneHref from "@/hooks/useZoneHref";
import useUrlProductFilters from "@/hooks/useUrlProductFilters";
const CountryListing = () => {
  const zoneHref = useZoneHref();
  const { buildQueryPatch } = useUrlProductFilters();
  const router = useRouter();
  const dispatch = useDispatch();
  const city = useSelector((state: any) => state.City.city);

  const countriesPerPage = 12;
  const [countries, setCountries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  const handleFetchCountries = useCallback(async () => {
    setIsLoading(true);
    setIsError(false);
    try {
      const response = await api.getCountries({
        limit: countriesPerPage,
        offset: 0,
        latitude: city?.latitude,
        longitude: city?.longitude,
      });
      console.log(response?.data);
      setCountries(response?.data);
    } catch (error) {
      setIsError(true);
      console.log("Error:", error);
    }
    setIsLoading(false);
  }, [city]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount/city change
    handleFetchCountries();
  }, [handleFetchCountries]);

  const handleCountryClick = (country: any) => {
    dispatch(clearAllFilter());
    const qs = new URLSearchParams(
      buildQueryPatch({ country_id: country?.id }),
    ).toString();
    const dest = zoneHref("/products");
    router.push(qs ? `${dest}?${qs}` : dest);
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
              onClick={handleFetchCountries}
              className="rounded-lg primaryBackColor py-2 px-5 text-white text-sm font-medium"
            >
              {t("retry") || t("try_again") || "Retry"}
            </button>
          </div>
        ) : (
          <div
            className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 h-auto my-5 p-2`}
          >
            {countries &&
              countries?.map((country: any) => {
                return (
                  <div
                    key={country?.id}
                    role="button"
                    tabIndex={0}
                    aria-label={country?.name}
                    className={"col-span-1 cursor-pointer"}
                    onClick={() => handleCountryClick(country)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleCountryClick(country);
                      }
                    }}
                  >
                    <Country country={country} />
                  </div>
                );
              })}
            {isLoading &&
              Array.from({ length: countriesPerPage }).map((_, index: number) => (
                <div key={index}>
                  <CardSkeleton height={150} />
                </div>
              ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default CountryListing;
