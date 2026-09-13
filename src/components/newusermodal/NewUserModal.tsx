import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { useSelector, useDispatch } from "react-redux";
import { t } from "@/utils/translation";
import * as api from "@/api/apiRoutes";
import { toast } from "react-toastify";
import { RiCloseFill } from "react-icons/ri";
import { setAuthType, setCurrentUser } from "@/redux/slices/userSlice";
import {
  clearAllGuestCarts,
  setCart,
  setCartProducts,
  setCartSubTotal,
  setDoorStepDeliveryMode,
  setIsGuest,
  setSelfPickupMode,
} from "@/redux/slices/cartSlice";
import { setSetting } from "@/redux/slices/settingSlice";
import { setTokenThunk } from "@/redux/thunk/loginthunk";
import ImageWithPlaceholder from "../image-with-placeholder/ImageWithPlaceholder";
import CountrySelect from "../phonenumberinput/CountrySelect";
import {
  getMobileLengthBounds,
  validateMobileLength,
} from "@/utils/mobileValidation";

// Country row shape comes from the API (getDialCountries) — not modeled here,
// `any` is used for the raw country object per the established boundary policy.
interface NewUserModalProps {
  showNewUser: boolean;
  setShowNewUser: (value: boolean) => void;
  setUserName: (value: string) => void;
  setPhoneNumberWithoutCountryCode: (value: string) => void;
  setEmail: (value: string) => void;
  userName: string;
  email: string;
  phoneNumberWithoutCountryCode: string;
  countryCode: string;
  setCountryCode: (value: string) => void;
  setIsOTP: (value: boolean) => void;
}

const NewUserModal = ({
  showNewUser,
  setShowNewUser,
  setUserName,
  setPhoneNumberWithoutCountryCode,
  setEmail,
  userName,
  email,
  phoneNumberWithoutCountryCode,
  countryCode,
  setCountryCode,
  setIsOTP,
}: NewUserModalProps) => {
  const dispatch = useDispatch();
  const authType = useSelector((state: any) => state.User.authType);
  const cart = useSelector((state: any) => state.Cart);
  const setting = useSelector((state: any) => state.Setting.setting);
  const city = useSelector((state: any) => state.City.city);

  const [loading, setLoading] = useState(false);
  const [selectedCountryId, setSelectedCountryId] = useState<number | string | null>(null);
  // The full country row (not just its id) from the picker below, because the
  // mobile length bounds live on it. This screen uses a standalone CountrySelect
  // rather than PhoneNumberInput, so the bounds are read here instead of
  // arriving via an onChange payload.
  const [selectedCountry, setSelectedCountry] = useState<any>(null);
  const { max: mobileMaxLength } = getMobileLengthBounds(selectedCountry);
  // The mobile field is optional here, so an empty value yields no error; a
  // typed one must fit its country's bounds before register.
  const phoneLengthError = validateMobileLength(
    phoneNumberWithoutCountryCode,
    selectedCountry,
  );

  // Google/email registration has no OTP flow to capture a dial code, so let the
  // user pick a country here and mirror its dial_code into countryCode.
  const handleCountrySelect = (country: any) => {
    setSelectedCountryId(country?.id ?? null);
    setSelectedCountry(country ?? null);
    setCountryCode?.(country?.dial_code || "");
  };
  const [friendCode, setFriendCode] = useState<string | null>(null);

  // NOTE: do NOT clear phoneNumberWithoutCountryCode here. For phone-auth
  // signups the number was already verified via OTP and must stay autofilled
  // in the (disabled) mobile field. Clearing it left the field blank.

  const handleChangeUserName = (e: React.ChangeEvent<HTMLInputElement>) => {
    setUserName(e.target.value);
  };
  const handleChangeEmail = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };
  const handleChangePhoneNumber = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Hard stop at the selected country's max_mobile_length — extra keystrokes
    // are dropped rather than accepted-then-rejected.
    setPhoneNumberWithoutCountryCode(
      e.target.value.replace(/\D/g, "").slice(0, mobileMaxLength),
    );
  };
  const handleFriendCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFriendCode(e.target.value);
  };


  // Name is the only always-required field. The account already carries the
  // credential it was created with (phone auth prefills the mobile, email/google
  // prefill the email), so the OTHER contact field is optional to fill in here.
  // A typed mobile still has to fit its country's min/max_mobile_length; an
  // empty one produces no lengthError, so the field stays optional.
  const isRegisterValid = !!userName?.trim() && !phoneLengthError;

  const handleUserRegister = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    if (phoneLengthError) {
      toast.error(phoneLengthError);
      return;
    }
    if (!isRegisterValid) return;
    setLoading(true);
    try {
      // Backend requires a dial code (e.g. "+91") for phone signups. Fall back to
      // the configured default if countryCode arrived empty or as an ISO code.
      const dialCode =
        countryCode && countryCode.startsWith("+")
          ? countryCode
          : process.env.NEXT_PUBLIC_COUNTRY_DIAL_CODE;
      const result = await api.registerUser({
        name: userName,
        email: email,
        mobile: phoneNumberWithoutCountryCode,
        country_code: dialCode,
        country_id: selectedCountryId,
        type: authType,
        friend_code: friendCode,
      });
      if (result?.status == 1) {
        const tokenSet = await (dispatch as any)(
          setTokenThunk(result?.data?.access_token)
        );
        await getCurrentUser();
        dispatch(setAuthType({ data: authType }));
        // if (result?.data?.user?.status == 1) {
        dispatch(setIsGuest({ data: false }));
        // }
        await handleFetchSetting();
        if (
          cart?.isGuest === true &&
          cart?.guestCart?.length !== 0 &&
          result?.data?.user?.status == 1
        ) {
          // addToBulkCart takes no params (reads `cart` from closure); the
          // access_token argument here was already ignored at runtime in the
          // original .jsx — dropped only because TS now enforces arity.
          await addToBulkCart();
        }
        await fetchCart();
        setLoading(false);
        setShowNewUser(false);
        setIsOTP(false);
      } else {
        // Backend `message` is often a raw English sentence, not a translation
        // key, so t() returns undefined and the toast shows blank. Fall back to
        // the raw message (and status_code) so the user always sees the reason.
        toast.error(
          t(result?.message) || result?.message || t(result?.status_code),
        );
        setLoading(false);
      }
    } catch (error: any) {
      console.log("error", error);
      setLoading(false);
    }
  };

  const handleFetchSetting = async () => {
    try {
      const res = await api.getSetting();
      // res.data may be a base64 JSON string OR an already-parsed object; guard
      // the atob() to avoid InvalidCharacterError (mirrors Layout.jsx).
      const parsedSetting =
        typeof res.data === "string" ? JSON.parse(atob(res.data)) : res.data;
      dispatch(setSetting({ data: parsedSetting }));
    } catch (error: any) {
      console.log("error", error);
    }
  };

  const getCurrentUser = async () => {
    try {
      const response = await api.getUser();
      dispatch(setCurrentUser({ data: response.data }));
      toast.success(t("login_success"));
    } catch (error: any) {
      console.log("error", error);
    }
  };

  const addToBulkCart = async () => {
    try {
      // Guest carts are per-channel — merge BOTH (quick + ecommerce) at register.
      const byChannel = cart?.guestCartByChannel || {
        quick: cart?.guestCart || [],
        ecommerce: [],
      };
      const quick = byChannel.quick || [];
      const ecommerce = byChannel.ecommerce || [];
      if (quick.length === 0 && ecommerce.length === 0) return;
      const response = await api.addToBulkCart({
        quick_variant_ids: quick.length
          ? quick.map((p: any) => p.product_variant_id).join(",")
          : undefined,
        quick_quantities: quick.length
          ? quick.map((p: any) => p.qty).join(",")
          : undefined,
        ecommerce_variant_ids: ecommerce.length
          ? ecommerce.map((p: any) => p.product_variant_id).join(",")
          : undefined,
        ecommerce_quantities: ecommerce.length
          ? ecommerce.map((p: any) => p.qty).join(",")
          : undefined,
        latitude: city?.latitude || setting?.default_city?.latitude,
        longitude: city?.longitude || setting?.default_city?.longitude,
      });
      if (response.status == 1) {
        dispatch(clearAllGuestCarts());
        dispatch(setCartSubTotal({ data: response.sub_total }));
      } else {
        console.log("Error while adding bulk products");
      }
    } catch (error: any) {
      console.log("Error", error);
    }
  };

  const fetchCart = async () => {
    const latitude = city?.latitude || setting?.default_city?.latitude;
    const longitude = city?.longitude || setting?.default_city?.longitude;
    try {
      const response = await api.getCart({
        latitude: latitude,
        longitude: longitude,
      });
      if (response.status === 1) {
        dispatch(setCart({ data: response.data }));
        const productsData = getProductData(response.data);
        dispatch(setCartProducts({ data: productsData }));
        dispatch(setCartSubTotal({ data: response?.data?.sub_total }));
        dispatch(setSelfPickupMode({ data: response?.data?.self_pickup_mode }));
        dispatch(
          setDoorStepDeliveryMode({
            data: response?.data?.doorstep_delivery_mode,
          })
        );
      } else {
        dispatch(setCart({ data: null }));
      }
    } catch (error: any) {
      console.log("error", error);
    }
  };

  const getProductData = (cartData: any) => {
    const cartProducts = cartData?.cart?.map((product: any) => {
      return {
        product_id: product?.product_id,
        product_variant_id: product?.product_variant_id,
        qty: product?.qty,
      };
    });
    return cartProducts;
  };

  return (
    <Dialog open={showNewUser}>
      <DialogContent className="" title={t("register")}>
        <DialogHeader className="flex flex-row justify-between items-center">
          <div className="">
            <h1 className="text-3xl font-bold">{t("register")}</h1>
          </div>
          <div className="closeButtonBg rounded-full p-[8px] gap-[4px] cursor-pointer">
            <RiCloseFill size={22} onClick={() => setShowNewUser(false)} />
          </div>
        </DialogHeader>
        <div>
          <p className="text-xs text-center mb-2">
            {t("update_your_profile_note")}
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <span className="font-bold text-base">
                {t("name")} <span className="text-red-500">*</span>
              </span>
              <input
                type="text"
                aria-label={t("name")}
                className="py-2 px-4 cardBorder outline-none rounded-sm disabled:text-gray-500"
                placeholder={t("name")}
                value={userName}
                onChange={handleChangeUserName}
              />
              {!userName?.trim() && (
                <span className="text-xs text-red-500">
                  {t("username_required")}
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-bold text-base">{t("email")}</span>
              <input
                type="email"
                aria-label={t("email")}
                className="py-2 px-4 cardBorder outline-none rounded-sm disabled:text-gray-500"
                placeholder={t("email")}
                value={email}
                disabled={
                  authType == "email" || authType == "google" ? true : false
                }
                onChange={handleChangeEmail}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-bold text-base">
                {t("country") || "Country"}
              </span>
              <CountrySelect
                value={selectedCountryId}
                onChange={handleCountrySelect}
                onReady={handleCountrySelect}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-bold text-base">{t("mobileNumber")}</span>
              <input
                type="tel"
                inputMode="numeric"
                aria-label={t("mobileNumber")}
                maxLength={mobileMaxLength}
                className="py-2 px-4 cardBorder outline-none rounded-sm disabled:text-gray-400"
                placeholder={t("mobileNumber")}
                value={phoneNumberWithoutCountryCode}
                disabled={authType == "phone" ? true : false}
                onChange={handleChangePhoneNumber}
              />
              {phoneLengthError && (
                <span className="text-xs text-red-500">{phoneLengthError}</span>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-bold text-base">{t("friend_code")}</span>
              <input
                type="text"
                aria-label={t("friend_code")}
                className="py-2 px-4 cardBorder outline-none rounded-sm disabled:text-gray-400"
                placeholder={t("friend_code")}
                value={friendCode ?? undefined}
                onChange={handleFriendCodeChange}
              />
            </div>
            <button
              className="bg-[#29363F] py-2 my-2 px-4 cursor-pointer text-white text-center rounded-sm text-xl font-normal disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={handleUserRegister}
              disabled={loading || !isRegisterValid}
            >
              {loading ? t("loading") : t("register")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewUserModal;
