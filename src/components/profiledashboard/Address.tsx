"use client";

import React, { use, useEffect, useState } from "react";
import { t } from "@/utils/translation";
import { CiCirclePlus } from "react-icons/ci";
import AddressCard from "../cards/AddressCard";
import dynamic from "next/dynamic";
const NewAddressModal = dynamic(
  () => import("../newaddressmodal/NewAddressModal"),
  {
    ssr: false,
  },
);
import * as api from "@/api/apiRoutes";
import { useSelector, useDispatch } from "react-redux";
import { setAllAddresses } from "@/redux/slices/addressSlice";
import CardSkeleton from "../skeleton/CardSkeleton";
import { GoPlusCircle } from "react-icons/go";
import ThemedSvg from "@/components/notfound/ThemedSvg";
import NoAddressImage from "@/assets/empty-state/no-address.svg";

const Address = () => {
  const dispatch = useDispatch();

  const addresses = useSelector((state: any) => state.Addresses);
  const [showAddAddres, setShowAddAddres] = useState(false);
  const [isAddressSelected, setIsAddressSelected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isError, setIsError] = useState(false);

  // const addressPerPage = 10;

  const fetchAddress = async () => {
    setLoading(true);
    setIsError(false);
    try {
      const response = await api.getAddress();
      if (response.status == 1) {
        dispatch(setAllAddresses({ data: response.data }));
      } else {
        dispatch(setAllAddresses({ data: [] }));
      }
      setLoading(false);
    } catch (error) {
      setLoading(false);
      setIsError(true);
      console.log("Error", error);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount pattern; not derivable from render
    fetchAddress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleshowAddres = () => {
    setIsAddressSelected(false);
    setShowAddAddres(true);
  };

  return (
    <div className="w-full overflow-hidden rounded-xl cardBorder bg-white dark:bg-zinc-900">
      <div className="backgroundColor flex flex-wrap justify-between gap-3 p-4 items-center border-b border-slate-200 dark:border-zinc-700">
        <h2 className="font-bold text-lg sm:text-xl">{t("manage_address")}</h2>
        {addresses?.allAddresses?.length > 0 && (
          <button
            className="flex items-center gap-1.5 py-2 px-3 sm:px-4 rounded-lg text-sm sm:text-base font-medium primaryBackColor text-white hover:opacity-90 transition"
            onClick={handleshowAddres}
          >
            <CiCirclePlus size={22} />
            {t("add_new_address")}
          </button>
        )}
      </div>
      <div className="p-4 sm:p-5">
        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Array?.from({ length: 4 })?.map((_, index) => (
              <CardSkeleton key={index} height={200} padding="2px" />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
            <p className="font-semibold text-base fontColor">
              {t("something_went_wrong") || "Something went wrong"}
            </p>
            <button
              type="button"
              onClick={fetchAddress}
              className="rounded-lg primaryBackColor py-2 px-5 text-white text-sm font-medium"
            >
              {t("retry") || t("try_again") || "Retry"}
            </button>
          </div>
        ) : addresses?.allAddresses?.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {addresses?.allAddresses?.map((address) => (
              <AddressCard
                key={address?.id}
                address={address}
                setShowAddAddres={setShowAddAddres}
                setIsAddressSelected={setIsAddressSelected}
                fetchAddress={fetchAddress}
                fromAddress={true}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            <ThemedSvg
              src={NoAddressImage}
              alt={t("no_address_found") || t("add_address")}
              className="w-3/4 max-w-[240px]"
            />
            <button
              type="button"
              onClick={() => setShowAddAddres(true)}
              className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 dark:border-zinc-700 px-6 py-3 text-lg font-bold SecondaryTextColor hover:primaryBorder hover:primaryColor transition-colors"
            >
              <GoPlusCircle size={22} /> {t("add_address")}
            </button>
          </div>
        )}
      </div>
      {showAddAddres && (
        <NewAddressModal
          showAddAddres={showAddAddres}
          setShowAddAddres={setShowAddAddres}
          isAddressSelected={isAddressSelected}
          fetchAddress={fetchAddress}
        />
      )}
    </div>
  );
};

export default Address;
