"use client";

import React, { useCallback, useEffect, useState } from "react";
import BreadCrumb from "../breadcrumb/BreadCrumb";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/navigation";
import * as api from "@/api/apiRoutes";
import BrandCard from "./BrandCard";
import { clearAllFilter } from "@/redux/slices/productFilterSlice";
import CardSkeleton from "../skeleton/CardSkeleton";
import { t } from "@/utils/translation"; // Assuming you have a translation utility
import useZoneHref from "@/hooks/useZoneHref";
import useUrlProductFilters from "@/hooks/useUrlProductFilters";

const Brands = () => {
  const zoneHref = useZoneHref();
  const { buildQueryPatch } = useUrlProductFilters();
  const dispatch = useDispatch();
  const router = useRouter();
  const brandsPerPage = 12;
  const lat = useSelector((state: any) => state.City.city?.latitude);
  const lng = useSelector((state: any) => state.City.city?.longitude);

  const [brands, setBrands] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalBrands, setTotalBrands] = useState(0);
  const [page, setPage] = useState(1);

  const fetchBrands = useCallback(
    async (offset: number = 0) => {
      setIsLoading(true);
      try {
        const response = await api.getBrands({
          limit: brandsPerPage,
          offset,
          latitude: lat,
          longitude: lng,
        });
        setBrands(response.data || []);
        setTotalBrands(response?.total || 0); // Assuming total count is in response.data.total
      } catch (error) {
        console.log("Error fetching brands:", error);
      }
      setIsLoading(false);
    },
    [lat, lng],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset pagination when zone changes
    setPage(1);
  }, [lat, lng]);

  useEffect(() => {
    const offset = (page - 1) * brandsPerPage;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on page/zone change
    fetchBrands(offset);
  }, [page, lat, lng, fetchBrands]);

  const handleBrandClick = (brand: any) => {
    dispatch(clearAllFilter());
    const qs = new URLSearchParams(
      buildQueryPatch({ brand_ids: [brand?.id] }),
    ).toString();
    const dest = zoneHref("/products");
    router.push(qs ? `${dest}?${qs}` : dest);
  };

  const totalPages = Math.ceil(totalBrands / brandsPerPage);

  return (
    <section>
      <BreadCrumb />
      <div className="container">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 h-auto my-5 px-2">
          {isLoading
            ? Array.from({ length: brandsPerPage }).map((_, index: number) => (
                <div key={index} className="col-span-1">
                  <CardSkeleton height={150} />
                </div>
              ))
            : brands.map((brand: any) => (
                <div
                  key={brand?.id}
                  className="col-span-1 cursor-pointer"
                  onClick={() => handleBrandClick(brand)}
                >
                  <BrandCard brand={brand} />
                </div>
              ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center my-6 gap-2 flex-wrap">
            <button
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
              disabled={page === 1}
              className={`px-4 py-2 rounded-md border text-sm font-medium transition-all duration-200 ${
                page === 1
                  ? "backgroundColor text-gray-500 cursor-not-allowed"
                  : "buttonBackground hover:backgroundColor textColor"
              }`}
            >
              {t("prev")}
            </button>

            {Array.from({ length: totalPages }).map((_, idx) => {
              const pageNumber = idx + 1;
              return (
                <button
                  key={pageNumber}
                  onClick={() => setPage(pageNumber)}
                  className={`px-4 py-2 rounded-md border text-sm font-medium transition-all duration-200 ${
                    page === pageNumber
                      ? "primaryBackColor text-white primaryBorder"
                      : "backgroundColor textColor hover:backgroundColor"
                  }`}
                >
                  {pageNumber}
                </button>
              );
            })}

            <button
              onClick={() =>
                setPage((prev) => (prev < totalPages ? prev + 1 : prev))
              }
              disabled={page === totalPages}
              className={`px-4 py-2 rounded-md border text-sm font-medium transition-all duration-200 ${
                page === totalPages
                  ? "backgroundColor text-gray-500 cursor-not-allowed"
                  : "backgroundColor hover:backgroundColor textColor"
              }`}
            >
              {t("next")}
            </button>
          </div>
        )}
      </div>
    </section>
  );
};

export default Brands;
