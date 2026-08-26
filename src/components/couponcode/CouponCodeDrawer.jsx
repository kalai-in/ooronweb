import React, { useState, useEffect, useCallback } from "react";
import * as api from "@/api/apiRoutes";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { RiCloseFill } from "react-icons/ri";
import { t } from "@/utils/translation";
import CouponCodeCard from "./CouponCodeCard";
import { useSelector } from "react-redux";
import NoCouponFound from "@/assets/empty-state/no-coupon.svg";
import ThemedSvg from "@/components/notfound/ThemedSvg";
import useDir from "@/hooks/useDir";

const CouponCodeDrawer = ({ showCouponCode, setShowCouponCode }) => {
  const cart = useSelector((state) => state.Cart);
  const city = useSelector((state) => state.City);
  const checkout = useSelector((state) => state.Checkout);
  const language = useSelector((state) => state.Language.selectedLanguage);
  const dir = useDir();
  const [couponCodes, setCouponCodes] = useState([]);

  const handleFetchCouponCodes = useCallback(async () => {
    try {
      const response = await api.getPromo({
        amount: cart?.cartSubTotal,
        latitude: city?.city?.latitude,
        longitude: city?.city?.longitude,
      });
      setCouponCodes(response.data);
    } catch (error) {
      console.log("Error", error);
    }
  }, [cart, city]);

  useEffect(() => {
    if (showCouponCode) {
      handleFetchCouponCodes();
    }
  }, [showCouponCode, handleFetchCouponCodes]);

  const handleHideCouponCode = () => {
    setShowCouponCode(false);
  };
  return (
    <Sheet open={showCouponCode} modal={false}>
      <SheetContent
        className="flex h-screen w-full flex-col p-0"
        side={dir === "RTL" ? "left" : "right"}
        dir={dir}
      >
        <SheetHeader className="border-b px-0 py-3 text-left">
          <SheetTitle className="flex flex-row items-center justify-between p-2 text-2xl font-bold">
            <p className="text-2xl font-bold">{t("coupons")}</p>
            <div className="closeButtonBg rounded-full p-[8px]">
              <RiCloseFill
                className="hover:cursor-pointer"
                size={22}
                onClick={() => handleHideCouponCode(false)}
              />
            </div>
          </SheetTitle>
        </SheetHeader>
        <div className="flex-grow overflow-y-auto p-3">
          {couponCodes?.length > 0 ? (
            <div className="flex flex-col gap-3">
              {couponCodes?.map((coupon) => (
                <CouponCodeCard
                  key={coupon?.id}
                  coupon={coupon}
                  setShowCouponCode={setShowCouponCode}
                />
              ))}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <ThemedSvg
                src={NoCouponFound}
                alt={"Image not found"}
                className="h-48 w-48"
              />
              <p className="text-lg font-bold">
                {t("no_coupon_code_available")}
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CouponCodeDrawer;
