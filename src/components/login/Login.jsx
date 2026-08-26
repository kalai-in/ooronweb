"use client";
import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import Image from "next/image";
import { t } from "@/utils/translation";
import GoogleLogo from "@/assets/googleLogin.svg";
import OtpInput from "react-otp-input";
import { useDispatch, useSelector, useStore } from "react-redux";
import {
  clearAllGuestCarts,
  setCart,
  setCartProducts,
  setCartSubTotal,
  setDoorStepDeliveryMode,
  setIsGuest,
  setSelfPickupMode,
} from "@/redux/slices/cartSlice";
import {
  setAuthId,
  setAuthType,
  setCurrentUser,
} from "@/redux/slices/userSlice";
import { FaRegEye, FaRegEyeSlash, FaRegEnvelope } from "react-icons/fa";
import { FiPhone, FiAlertCircle } from "react-icons/fi";
import PhoneNumberInput from "../phonenumberinput/PhoneNumberInput";
import { toast } from "react-toastify";
import * as api from "@/api/apiRoutes";
import { setTokenThunk } from "@/redux/thunk/loginthunk";
import NewUserModal from "../newusermodal/NewUserModal";
import { loadFirebaseAuth } from "@/utils/lazyFirebaseAuth";
import {
  getRecaptchaVerifier,
  clearRecaptchaVerifier,
} from "@/utils/recaptchaVerifier";
import { RiCloseFill } from "react-icons/ri";
import Register from "../register/Register";
import { setSetting } from "@/redux/slices/settingSlice";
import ForgetPasswordModal from "../forgetpasswordmodal/ForgetPasswordModal";
import Link from "next/link";
import useZoneHref from "@/hooks/useZoneHref";
import {
  isUserDeactivated,
  isDeactivatedUser,
  deactivatedMessage,
  clearLocalSession,
} from "@/utils/accountStatus";

// Normalizes status_code or message to snake_case so one check matches either.
const normalizeApiCode = (v) =>
  String(v || "")
    .trim()
    .toLowerCase()
    .replace(/[\s.]+/g, "_");

export function Login({ showLogin, setShowLogin, setMobileActiveKey }) {
  const zoneHref = useZoneHref();
  const store = useStore();
  // Reads guest cart live from store (avoids stale closure) across both channels.
  const getLiveGuestBuckets = () => {
    const liveCart = store.getState()?.Cart;
    const byCh = liveCart?.guestCartByChannel;
    return {
      quick: byCh?.quick ?? (liveCart?.guestCart || []),
      ecommerce: byCh?.ecommerce ?? [],
    };
  };
  const hasGuestItems = () => {
    const { quick, ecommerce } = getLiveGuestBuckets();
    return (quick?.length || 0) + (ecommerce?.length || 0) > 0;
  };

  // Live lat/long for cart APIs (required); falls back to default city.
  const getLiveCoords = () => {
    const state = store.getState();
    const liveCity = state?.City?.city;
    const defaultCity = state?.Setting?.setting?.default_city;
    return {
      latitude: liveCity?.latitude ?? defaultCity?.latitude,
      longitude: liveCity?.longitude ?? defaultCity?.longitude,
    };
  };
  const setting = useSelector((state) => state.Setting.setting);
  const fcmToken = useSelector((state) => state.User?.fcm_token);
  const dispatch = useDispatch();
  const inputRef = useRef(null);

  // Every login submit is a user gesture, so each is a safe place to ask for
  // notification permission if it's still undecided. Skipped when a token is
  // already cached (no unnecessary delay/import), and never blocks login if
  // the user denies or the browser doesn't support it.
  const resolveFcmToken = async () => {
    if (fcmToken) return fcmToken;
    const { fetchToken } = await loadFirebaseAuth();
    return (await fetchToken(dispatch, { prompt: true })) || fcmToken;
  };

  const [userName, setUserName] = useState("");
  const [showNewUser, setShowNewUser] = useState(false);
  const [isOTP, setIsOTP] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState(null);
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState(null);
  const [inputValue, setInputValue] = useState(null);
  const [inputType, setInputType] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phoneNumberWithoutCountryCode, setPhoneNumberWithoutCountryCode] =
    useState("");
  const [Uid, setUid] = useState("");
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(90);
  const [otpDisabled, setOtpDisabled] = useState(true);
  const [error, setError] = useState("");
  // Show empty-field errors only after blur/submit, not on open.
  const [touched, setTouched] = useState({ email: false, password: false });
  // Tints field red on server login rejection; cleared on edit.
  const [loginRejected, setLoginRejected] = useState(false);
  const [userAuthType, setUserAuthType] = useState("");
  const [showRegister, setShowRegister] = useState(false);
  const [showForgetPassword, setShowForgetPassword] = useState(false);
  const [phonePassword, setPhonePassword] = useState("");
  // Separate from `error`, which drives the PHONE field's red border. A wrong
  // password is not a problem with the number, so sharing one state painted the
  // phone input red and pointed the user at the wrong field.
  const [passwordError, setPasswordError] = useState("");
  const [forgotPasswordType, setForgotPasswordType] = useState("");
  const [isErrorMessage, setIsErrorMessage] = useState(false);
  // Digits the user types, without the dial code (driven by PhoneNumberInput).
  const [rawPhone, setRawPhone] = useState("");
  // Per-country min-length verdict from PhoneNumberInput; gates OTP submit.
  const [phoneLengthError, setPhoneLengthError] = useState(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [inputType]);

  useEffect(() => {
    // Intentional sync setState: seeds the dial code from an env var on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCountryCode(process.env.NEXT_PUBLIC_DEFAULT_COUNTRY_CODE);
  }, []);

  // Seed the dial code as soon as PhoneNumberInput resolves its default country.
  const handleCountryReady = (country) => {
    setCountryCode(country?.dial_code || "");
  };

  // Syncs phoneNumber/countryCode/without-code from PhoneNumberInput.
  const handlePhoneChange = ({ dialCode, rawPhone: digits, lengthError }) => {
    setRawPhone(digits);
    setPhoneLengthError(lengthError ?? null);
    setInputType("number");
    dispatch(setAuthType({ data: "phone" }));
    setCountryCode(dialCode);
    setPhoneNumberWithoutCountryCode(digits);
    // phoneNumber composed by the effect below, not set here (single writer).
    setInputValue(digits);
    setOtp("");
    // Editing the number clears stale errors from the previous number.
    if (error) setError("");
    if (passwordError) setPasswordError("");
  };

  // Composes phoneNumber from countryCode+digits so it never goes stale.
  // Skipped for social-signup (NewUserModal owns phoneNumber there).
  useEffect(() => {
    if (inputType === "email" || !showLogin || showNewUser) return;
    // Intentional sync setState: composes phoneNumber from countryCode+digits.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPhoneNumber(
      countryCode && phoneNumberWithoutCountryCode
        ? `${countryCode}${phoneNumberWithoutCountryCode}`
        : "",
    );
  }, [
    countryCode,
    phoneNumberWithoutCountryCode,
    inputType,
    showLogin,
    showNewUser,
  ]);

  useEffect(() => {
    // Skip while the user is on the email tab: handleEmailChange clears
    // countryCode on every keystroke, which re-fires this effect (countryCode
    // is a dep, needed to re-seed the demo number once the dial code loads)
    // and was forcing inputType back to "number" mid-typing.
    if (inputType === "email") return;
    if (showLogin === true && showRegister === false) {
      // demo_mode is server-toggled via settings API, not a build-time env var.
      if (setting?.demo_mode == 1) {
        const demoNo = process.env.NEXT_PUBLIC_DEMO_LOGIN_NO || "";
        // Intentional sync setState: seeds the demo login fields from settings/env.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setInputType("number");
        dispatch(setAuthType({ data: "phone" }));
        setRawPhone(demoNo);
        // phoneNumber composed by effect above once countryCode lands.
        setPhoneNumberWithoutCountryCode(demoNo);
        setOtp(process.env.NEXT_PUBLIC_DEMO_OTP || "");
      }
    }
    // countryCode dep: re-composes demo number once dial code resolves.
  }, [
    showLogin,
    countryCode,
    inputType,
    dispatch,
    setting?.demo_mode,
    showRegister,
  ]);

  // Seeds default login mode on open only; not on countryCode (would fight
  // typing in the email field, which clears countryCode on each keystroke).
  useEffect(() => {
    if (!showLogin) return;
    if (setting?.phone_login == 1) {
      setInputType("number");
    } else if (setting?.email_login == 1) {
      setInputType("email");
    }
  }, [showLogin, setting?.phone_login, setting?.email_login]);

  useEffect(() => {
    let interval;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer((prevTimer) => prevTimer - 1);
      }, 1000);
    } else if (timer === 0) {
      setOtpDisabled(false);
    }

    return () => clearInterval(interval);
  }, [timer]);

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = time % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;
  };

  // RecaptchaVerifier is a single shared instance across Login/Register/ForgetPassword.
  useEffect(() => {
    if (showLogin) {
      getRecaptchaVerifier("recaptcha-container");
    }
    return () => {
      clearRecaptchaVerifier();
    };
  }, [showLogin]);

  const handleShowRegister = (type) => {
    setShowRegister(true);
    setInputType(type);

    setError("");
    setPasswordError("");
  };

  const handleEmailChange = (value, data) => {
    setInputType("email");
    setEmail(value);
    setOtp("");
    setPhoneNumber("");
    setCountryCode("");
  };

  // Maps raw Firebase phone-auth error codes to friendly translated copy.
  const friendlyPhoneAuthError = (error) => {
    const raw = `${error?.code || ""} ${error?.message || ""}`.toLowerCase();
    if (
      raw.includes("too_short") ||
      raw.includes("too_long") ||
      raw.includes("invalid-phone") ||
      raw.includes("invalid_phone")
    )
      return t("invalid_phone_number_message");
    if (raw.includes("too-many-requests") || raw.includes("too_many"))
      return t("too_many_otp_requests");
    if (raw.includes("timeout"))
      return t("otp_send_timeout") || t("otp_send_failed");
    return t("otp_send_failed");
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    // Re-entrancy guard: blocks double-click racing two OTP sends.
    if (loading) return;
    setLoading(true);
    setOtpDisabled(true);
    if (!rawPhone?.trim()) {
      setError(t("please_enter_phone_number"));
      setLoading(false);
      setOtpDisabled(false);
    } else if (phoneLengthError) {
      // Under min_mobile_length — stop before burning an OTP the backend would reject.
      setError(phoneLengthError);
      setLoading(false);
      setOtpDisabled(false);
    } else {
      const phoneNumberWithoutSpaces = `${phoneNumber}`.replace(/\s+/g, "");
      if (setting?.firebase_authentication == 1) {
        try {
          const verifier = await getRecaptchaVerifier("recaptcha-container");
          if (!verifier) {
            setError(t("Something went wrong"));
            setLoading(false);
            setOtpDisabled(false);
            return;
          }
          console.log(
            "[otp] calling signInWithPhoneNumber",
            phoneNumberWithoutSpaces,
          );
          const { auth, signInWithPhoneNumber } = await loadFirebaseAuth();
          // Timeout guard: a stuck v2 challenge otherwise hangs forever with no error.
          const confirmationResult = await Promise.race([
            signInWithPhoneNumber(auth, phoneNumberWithoutSpaces, verifier),
            new Promise((_, reject) =>
              setTimeout(
                () =>
                  reject(
                    new Error(
                      "otp-send-timeout: signInWithPhoneNumber did not settle in 20s",
                    ),
                  ),
                20000,
              ),
            ),
          ]);
          console.log("[otp] signInWithPhoneNumber resolved");
          window.confirmationResult = confirmationResult;
          setTimer(90);
          setIsOTP(true);
          setLoading(false);
        } catch (error) {
          console.log("[otp] send failed:", error?.code, error?.message, error);
          // Spent verifier can't be reused — clear it so retry gets a fresh one.
          clearRecaptchaVerifier();
          setPhoneNumber("");
          setPhoneNumberWithoutCountryCode("");
          setRawPhone("");
          setError(friendlyPhoneAuthError(error));
          setLoading(false);
          setIsOTP(false);
        }
      } else if (setting?.custom_sms_gateway_otp_based == 1) {
        try {
          const res = await api.sendSms({
            mobile: phoneNumberWithoutSpaces,
          });
          if (res?.status == 1) {
            setTimer(90);
            setIsOTP(true);
            setLoading(false);
          } else {
            setError(t("custom_send_sms_error_message"));
            setLoading(false);
          }
        } catch (error) {
          console.log("[otp] send failed:", error?.code, error?.message, error);
          setPhoneNumber("");
          setPhoneNumberWithoutCountryCode("");
          setRawPhone("");
          setError(t("custom_send_sms_error_message"));
          setLoading(false);
        }
      } else {
        toast.error(t("Something went wrong"));
        setLoading(false);
      }
    }
  };

  const handleOtpVerification = async (e) => {
    e.preventDefault();
    if (!otp || otp.length < 6) {
      setError(t("otp_required"));
      return;
    }
    if (setting?.firebase_authentication == 1) {
      setLoading(true);
      try {
        const user = await window.confirmationResult.confirm(otp);
        dispatch(setAuthId({ data: user.user.uid }));
        setUid(user.user.uid);
        await loginApiCall(
          user.user,
          phoneNumberWithoutCountryCode,
          await resolveFcmToken(),
          "phone",
        );
        setLoading(false);
      } catch (error) {
        setLoading(false);
        toast.error(t("invalid_otp"));
      }
    } else if (setting?.custom_sms_gateway_otp_based == 1) {
      try {
        const response = await api.verifyOTP({
          mobile: phoneNumberWithoutCountryCode,
          country_code: countryCode,
          otp: otp,
        });
        if (
          response?.status == 1 &&
          response?.message == "otp_valid_but_user_invalid"
        ) {
          setShowNewUser(true);
          setShowLogin(false);
          setIsOTP(false);
          dispatch(setAuthType({ data: "phone" }));
          // Keeps verified phoneNumberWithoutCountryCode for NewUserModal's disabled field.
          setUserName("");
          setEmail("");
        } else if (isUserDeactivated(response)) {
          // OTP verify also doubles as login, so a deactivated account can land here too.
          handleDeactivatedAccount(response);
          return;
        } else if (response?.status == 1) {
          await dispatch(setTokenThunk(response?.data?.access_token));
          // getCurrentUser returns false if the account is deactivated (already logged out/toasted).
          if (!(await getCurrentUser())) return;
          dispatch(setAuthType({ data: "phone" }));
          if (response?.data?.user?.status == 1) {
            dispatch(setIsGuest({ data: false }));
          }
          await handleFetchSetting();
          console.log("[bulk-merge] otp-verify:", {
            hasGuestItems: hasGuestItems(),
            buckets: getLiveGuestBuckets(),
          });
          if (hasGuestItems()) {
            await addToBulkCart(response?.data.access_token);
          }
          await fetchCart();
          setError("");
          setPasswordError("");
          setOtp("");
          setPhoneNumber("");
          setPhoneNumberWithoutCountryCode("");
          setRawPhone("");
          setLoading(false);
          setIsOTP(false);
          setShowLogin(false);
        } else {
          toast.error(t("invalid_otp") || "Invalid OTP");
          setLoading(false);
        }
      } catch (error) {
        console.log("error", error);
      }
    }
  };

  const handleFetchSetting = async () => {
    try {
      const res = await api.getSetting();
      // res.data can be base64 JSON or already-parsed; guard atob() on type.
      const parsedSetting =
        typeof res.data === "string" ? JSON.parse(atob(res.data)) : res.data;
      dispatch(setSetting({ data: parsedSetting }));
    } catch (error) {
      console.log("error", error);
    }
  };

  const getProductData = (cartData) => {
    // Maps cart API's id/variant_id/quantity keys to product_id/product_variant_id/qty.
    const cartProducts = cartData?.cart?.map((product) => {
      return {
        product_id: product?.id ?? product?.product_id,
        product_variant_id: product?.variant_id ?? product?.product_variant_id,
        qty:
          product?.variants?.[0]?.quantity ?? product?.quantity ?? product?.qty,
      };
    });
    return cartProducts;
  };

  const fetchCart = async () => {
    const { latitude, longitude } = getLiveCoords();
    try {
      const response = await api.getCart({
        latitude: latitude,
        longitude: longitude,
      });
      if (response.status === 1) {
        dispatch(setCart({ data: response.data }));
        dispatch(setSelfPickupMode({ data: response?.data?.self_pickup_mode }));
        dispatch(
          setDoorStepDeliveryMode({
            data: response?.data?.doorstep_delivery_mode,
          }),
        );
        const productsData = getProductData(response.data);
        dispatch(setCartProducts({ data: productsData }));
        dispatch(setCartSubTotal({ data: response?.data?.sub_total }));
      } else {
        dispatch(setCart({ data: null }));
      }
    } catch (error) {
      console.log("error", error);
    }
  };

  const loginApiCall = async (user, id, fcm, type) => {
    setLoading(true);
    try {
      dispatch(setAuthId({ data: Uid, type }));
      const isPhoneAuthPassword =
        setting?.phone_auth_password == 1 ? true : false;
      const res = await api.login({
        id: id,
        fcm,
        type,
        country_code: countryCode,
        phoneAuthType: isPhoneAuthPassword,
        password: phonePassword,
      });
      // Matches status_code if present, else falls back to legacy message.
      const apiCode =
        normalizeApiCode(res?.status_code) || normalizeApiCode(res?.message);
      console.log("[login] api response:", {
        type,
        status: res?.status,
        status_code: res?.status_code,
        message: res?.message,
        apiCode,
      });
      if (res.status === 1) {
        // Deactivated accounts also return status:1 with no access_token — check first.
        if (isUserDeactivated(res)) {
          handleDeactivatedAccount(res);
          return;
        } else {
          await dispatch(setTokenThunk(res?.data?.access_token));
          if (!(await getCurrentUser())) return;
          dispatch(setAuthType({ data: type }));
          if (res?.data?.user?.status == 1) {
            dispatch(setIsGuest({ data: false }));
          }
          await handleFetchSetting();
          // TEMP diagnostic — shows why the merge may skip.
          console.log("[bulk-merge] loginApiCall:", {
            type,
            resStatus: res?.status,
            userStatus: res?.data?.user?.status,
            hasGuestItems: hasGuestItems(),
            buckets: getLiveGuestBuckets(),
          });
          // Merge on any successful login with guest items (some types omit user.status).
          if (hasGuestItems()) {
            await addToBulkCart(res?.data.access_token);
          }
          await fetchCart();
          setError("");
          setPasswordError("");
          setOtp("");
          setPhoneNumber("");
          setPhoneNumberWithoutCountryCode("");
          setRawPhone("");
          setLoading(false);
          setIsOTP(false);
          setShowLogin(false);
          setShowRegister(false);
        }
      } else if (apiCode == "user_exist_with_email") {
        toast.error(t("user_exist_with_email"));
        setLoading(false);
      } else if (apiCode == "user_exist_password_blank") {
        setIsErrorMessage(t("forget_password_note"));
        handleShowForgotPassword("phone");
        setLoading(false);
      } else if (apiCode == "invalid_password") {
        // Kept off `error` so it doesn't flag the phone field for a password mistake.
        setPasswordError(t("password_not_valid"));
        setPhonePassword("");
        setLoading(false);
      } else if (apiCode == "user_not_exist" && type == "google") {
        // Google verified but no account exists — this is a signup, not a failure.
        // Must be checked before the phone/status==0 branches below, which would
        // otherwise wrongly catch Google logins (isPhoneAuthPassword is global).
        setUserAuthType(type);
        setEmail(user?.email || user?.providerData?.[0]?.email || "");
        setUserName(
          user?.displayName || user?.providerData?.[0]?.displayName || "",
        );
        // Google rarely returns a phone; leave blank so NewUserModal stays editable.
        setPhoneNumberWithoutCountryCode("");
        setShowNewUser(true);
        // Not setShowLogin(false): NewUserModal renders inside <Login>, so closing
        // login here would unmount it too. Dialog hides via !showNewUser instead.
        setLoading(false);
      } else if (
        apiCode == "user_not_exist" &&
        type == "phone" &&
        isPhoneAuthPassword == true
      ) {
        // Scoped to phone: isPhoneAuthPassword is a global setting, so without
        // this check social logins would hit this branch too.
        setError(t("user_not_exist"));
        setLoading(false);
      } else if (apiCode == "user_exist_with_google") {
        setError(t("user_exist_with_google"));
        setLoading(false);
      } else if (res?.status == 0) {
        // Show the API's own reason instead of falling through to the signup branch.
        setError(res?.message || t("Something went wrong"));
        setLoading(false);
      } else {
        setUserAuthType(type);
        setEmail(user?.providerData?.[0]?.email);
        setUserName(user?.providerData?.[0]?.displayName);
        setPhoneNumber(user?.providerData?.[0]?.phoneNumber);
        setShowNewUser(true);
        setShowLogin(false);
        setLoading(false);
      }
    } catch (error) {
      console.error("error", error);
      setLoading(false);
    }
  };

  // Tears down any partial session and closes the modal on a deactivated account.
  const handleDeactivatedAccount = (res) => {
    toast.error(deactivatedMessage(res));
    clearLocalSession();
    setLoading(false);
    setError("");
    setPasswordError("");
    setOtp("");
    setPassword("");
    setPhonePassword("");
    setIsOTP(false);
    setShowRegister(false);
    setShowLogin(false);
  };

  const getCurrentUser = async () => {
    try {
      const response = await api.getUser();
      // Account may deactivate between login and this fetch; some types only surface it here.
      if (isDeactivatedUser(response?.data)) {
        handleDeactivatedAccount(response);
        return false;
      }
      dispatch(setCurrentUser({ data: response.data }));
      toast.success(t("login_success"));
      return true;
    } catch (error) {
      console.log("error", error);
      return false;
    }
  };

  const handlePasswordShow = () => {
    setShowPassword(!showPassword);
  };

  const handleShowForgotPassword = (type) => {
    setPhonePassword("");
    // setShowLogin(false);
    setForgotPasswordType(type);
    setShowForgetPassword(true);
  };

  const handleHideLogin = async () => {
    clearRecaptchaVerifier();
    setIsOTP(false);
    setShowLogin(false);
    setError("");
    setPasswordError("");
    setInputValue("");
    setInputType("");
    setLoading(false);
    setMobileActiveKey(1);
    setEmail("");
    setPassword("");
    setTouched({ email: false, password: false });
    setLoginRejected(false);
  };

  const handleGoogleLogin = async () => {
    try {
      const { auth, GoogleAuthProvider, signInWithPopup } =
        await loadFirebaseAuth();
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result?.user;
      dispatch(setAuthType({ data: "google" }));
      console.log("[bulk-merge] google login → loginApiCall", {
        buckets: getLiveGuestBuckets(),
      });
      await loginApiCall(
        user,
        user?.providerData[0].email,
        await resolveFcmToken(),
        "google",
      );
    } catch (error) {
      if (error?.message?.includes("auth/popup-closed-by-user")) {
        toast.error(t("popup_closed_by_user"));
      }
    }
  };

  // Detects "email not verified" from status_code or legacy message to trigger OTP.
  const isEmailNotVerified = (res) =>
    normalizeApiCode(res?.status_code) === "email_not_verified" ||
    normalizeApiCode(res?.message) === "email_not_verified";

  const handleEmailLogin = async (e) => {
    setLoading(true);

    if (e != undefined) {
      e.preventDefault();
    }
    if (!email || !password) {
      setTouched({ email: true, password: true });
      setError(t("email_password_mandatory"));
      setLoading(false);
      return;
    }
    try {
      const res = await api.login({
        id: email,
        type: "email",
        password: password,
        fcm: await resolveFcmToken(),
      });
      if (res.status === 1) {
        // Deactivated accounts return status:1 with no access_token — reject first.
        if (isUserDeactivated(res)) {
          handleDeactivatedAccount(res);
          return;
        } else {
          const tokenSet = await dispatch(
            setTokenThunk(res?.data?.access_token),
          );
          if (!(await getCurrentUser())) return;
          dispatch(setAuthType({ data: "email" }));
          if (res?.data?.user?.status == 1) {
            dispatch(setIsGuest({ data: false }));
          }
          // Login already succeeded; these follow-ups are best-effort and must
          // not bubble to the outer catch and double-toast an error.
          try {
            await handleFetchSetting();
            if (hasGuestItems()) {
              await addToBulkCart(res?.data.access_token);
            }
            await fetchCart();
          } catch (postLoginErr) {
            console.log("post-login step failed:", postLoginErr);
          }
          setError("");
          setPasswordError("");
          setOtp("");
          setPhoneNumber("");
          setPhoneNumberWithoutCountryCode("");
          setRawPhone("");
          setLoading(false);
          setIsOTP(false);
          setShowRegister(false);
          setShowLogin(false);
        }
      } else {
        setLoading(false);
        toast.error(res?.message || t("something_went_wrong"));
        setLoginRejected(true);
        if (isEmailNotVerified(res)) {
          setIsOTP(true);
          setOtp("");
        }
      }
    } catch (err) {
      // Network failure: no server message, but don't leave the button stuck loading.
      console.log("error", err);
      setLoading(false);
      toast.error(t("something_went_wrong"));
    }
  };

  const handleEmailVerify = async (e) => {
    e.preventDefault();
    try {
      const res = await api.verifyEmail({ email: email, code: otp });
      if (isUserDeactivated(res)) {
        handleDeactivatedAccount(res);
        return;
      }
      if (res.status == 1) {
        const tokenSet = await dispatch(setTokenThunk(res?.data?.access_token));
        if (!(await getCurrentUser())) return;
        dispatch(setAuthType({ data: "email" }));
        if (res?.data?.user?.status == 1) {
          dispatch(setIsGuest({ data: false }));
        }
        await handleFetchSetting();
        console.log("[bulk-merge] email-verify:", {
          hasGuestItems: hasGuestItems(),
          buckets: getLiveGuestBuckets(),
        });
        if (hasGuestItems()) {
          await addToBulkCart(res?.data?.access_token);
        }
        await fetchCart();
        // props.setShow(false)
        setIsOTP(false);
        setShowLogin(false);
      } else {
        setError(res.message);
        toast.error(res.message);
      }
    } catch (error) {
      console.log("error", error);
    }
  };

  const addToBulkCart = async () => {
    try {
      // Merges BOTH channels (quick + ecommerce) at login, read live to avoid stale closure.
      const { quick, ecommerce } = getLiveGuestBuckets();
      console.log("[bulk-merge] guest buckets at login:", {
        quick: quick.length,
        ecommerce: ecommerce.length,
      });
      if (quick.length === 0 && ecommerce.length === 0) return;
      const response = await api.addToBulkCart({
        quick_variant_ids: quick.length
          ? quick.map((p) => p.product_variant_id).join(",")
          : undefined,
        quick_quantities: quick.length
          ? quick.map((p) => p.qty).join(",")
          : undefined,
        ecommerce_variant_ids: ecommerce.length
          ? ecommerce.map((p) => p.product_variant_id).join(",")
          : undefined,
        ecommerce_quantities: ecommerce.length
          ? ecommerce.map((p) => p.qty).join(",")
          : undefined,
        ...getLiveCoords(),
      });
      if (response.status == 1) {
        // Both channels merged server-side — clear both guest buckets.
        dispatch(clearAllGuestCarts());
        dispatch(setCartSubTotal({ data: response.sub_total }));
      } else {
        console.log("Error while adding bulk products");
      }
    } catch (error) {
      console.log("Error", error);
    }
  };

  const handlePhoneLogin = async (e) => {
    e.preventDefault();
    if (setting?.phone_auth_password == 1) {
      if (!rawPhone?.trim()) {
        setError(t("please_enter_phone_number"));
        setLoading(false);
        return;
      } else if (!phonePassword) {
        setPasswordError(t("please_enter_password"));
        return;
      } else {
        loginApiCall(
          null,
          phoneNumberWithoutCountryCode,
          await resolveFcmToken(),
          "phone",
        );
      }
    } else {
      handleSendOTP(e);
    }
  };

  const renderPhoneInput = () => (
    <form onSubmit={handlePhoneLogin}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <PhoneNumberInput
            value={rawPhone}
            onChange={handlePhoneChange}
            onCountryReady={handleCountryReady}
            hasError={!!error}
            autoFocus
          />
          {error ? (
            <p className="text-xs text-red-500 font-semibold">{error}</p>
          ) : (
            <></>
          )}
        </div>
        {setting?.phone_auth_password == 1 && (
          // A <div>, not nested <form> — HTML forbids form-in-form.
          <div className="flex flex-col relative">
            <input
              type={showPassword ? "text" : "password"}
              aria-label={t("passwordMessage")}
              aria-invalid={!!passwordError || undefined}
              value={phonePassword}
              onChange={(e) => {
                setPhonePassword(e.target.value);
                // Clear stale error on next keystroke.
                if (passwordError) setPasswordError("");
              }}
              className={`border-[1px] py-2 px-4 rounded-sm w-full ${
                passwordError ? "border-red-400" : "border-[#CACACA]"
              }`}
              placeholder={t("passwordMessage")}
            />
            <button
              type="button"
              aria-label="Toggle password visibility"
              className="absolute end-[10px] top-[12px]"
              onClick={handlePasswordShow}
            >
              {showPassword ? <FaRegEye /> : <FaRegEyeSlash />}
            </button>
            {passwordError && (
              <p className="text-xs text-red-500 font-semibold mt-1">
                {passwordError}
              </p>
            )}
            <div className="text-base font-medium leading-6 mt-2 text-right">
              <button
                type="button"
                className="cursor-pointer"
                onClick={() => handleShowForgotPassword("phone")}
              >
                {t("forget_password_?")}
              </button>
            </div>
          </div>
        )}
      </div>
      <button
        disabled={loading}
        type="submit"
        className="primaryBackColor w-full px-4 py-2 text-white rounded-sm text-xl font-normal mt-4 transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {loading ? t("loading") : t("continue")}
      </button>
      {setting?.phone_auth_password == 1 && (
        <h2 className="mt-1 block md:flex justify-start md:justify-center gap-0 md:gap-1 text-base font-medium text-center">
          {t("registerMsg")}
          <button
            type="button"
            onClick={() => handleShowRegister("number")}
            className="primaryColor text-base font-medium underline ml-[2px] cursor-pointer"
          >
            {t("registerNow")}
          </button>
        </h2>
      )}
    </form>
  );

  // Inline field error: red border pairs with an icon + message beneath the input.
  const FieldError = ({ message }) => (
    <p className="flex items-center gap-1.5 text-xs text-red-500 mt-1">
      <FiAlertCircle className="shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );

  const showEmailError = touched.email && !email;
  // Inline text is for empty fields only; server rejections are toasted instead.
  const showPasswordError = touched.password && !password;
  // A rejected login still tints the field red, without repeating the toast's text.
  const passwordInvalid = showPasswordError || loginRejected;

  const renderEmailInput = () => (
    <form className="relative" onSubmit={handleEmailLogin}>
      <input
        type="email"
        required
        value={email}
        aria-label={t("email_placeholder")}
        aria-invalid={showEmailError ? "true" : undefined}
        onChange={(e) => {
          handleEmailChange(e.target.value, {});
          setLoginRejected(false);
        }}
        onBlur={() => setTouched((p) => ({ ...p, email: true }))}
        className={`border-[1px] py-2 px-4 rounded-sm w-full ${
          showEmailError ? "border-red-500" : "border-black"
        }`}
        placeholder={t("email_placeholder")}
        ref={inputRef}
      />
      {showEmailError && <FieldError message={t("please_enter_email")} />}
      <div className="relative mt-4">
        <input
          type={showPassword ? "text" : "password"}
          aria-label={t("passwordMessage")}
          aria-invalid={passwordInvalid ? "true" : undefined}
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setLoginRejected(false);
          }}
          onBlur={() => setTouched((p) => ({ ...p, password: true }))}
          className={`border-[1px] py-2 px-4 rounded-sm w-full ${
            passwordInvalid ? "border-red-500" : "border-black"
          }`}
          placeholder={t("passwordMessage")}
        />
        <button
          type="button"
          aria-label="Toggle password visibility"
          className="absolute right-[10px] top-[10px]"
          onClick={handlePasswordShow}
        >
          {showPassword ? <FaRegEye /> : <FaRegEyeSlash />}
        </button>
      </div>
      {showPasswordError && <FieldError message={t("please_enter_password")} />}
      <div className="text-base font-medium leading-6 mt-2 text-right">
        <button
          type="button"
          className="cursor-pointer"
          onClick={() => handleShowForgotPassword("email")}
        >
          {t("forget_password_?")}
        </button>
      </div>
      <button
        disabled={loading || !email || !password}
        type="submit"
        className="primaryBackColor w-full px-4 py-2 text-white rounded-sm text-xl font-normal mt-4 transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {loading ? t("loading") : t("continue")}
      </button>
      <h2 className="mt-1 block md:flex justify-start md:justify-center gap-0 md:gap-1 text-base font-medium text-center">
        {t("registerMsg")}
        <button
          type="button"
          onClick={() => handleShowRegister("email")}
          className="primaryColor text-base font-medium underline ml-[2px] cursor-pointer"
        >
          {t("registerNow")}
        </button>
      </h2>
    </form>
  );

  return (
    <>
      {/* !showNewUser: yields to the signup modal without unmounting <Login>. */}
      <Dialog
        open={showLogin && !showForgetPassword && !showRegister && !showNewUser}
      >
        <DialogContent
          className="overflow-y-auto overflow-x-hidden"
          title={t("login")}
        >
          <DialogHeader className="flex justify-between items-center flex-row">
            <div>
              <h1 className="text-3xl font-bold">{t("login")}</h1>
            </div>
            {/* <div className="relative aspect-square object-cover h-[68px] w-[72px]">
              <Image
                src={setting?.web_settings?.web_logo}
                alt="logo"
                fill
                className="aspect-square w-full h-full object-cover"
              />
            </div> */}
            <div className="closeButtonBg rounded-full p-[8px] gap-[4px] cursor-pointer">
              <RiCloseFill size={22} onClick={() => handleHideLogin()} />
            </div>
          </DialogHeader>
          <div className="">
            <div className="my-6">
              {isOTP ? (
                <div className="flex flex-col ">
                  <h5 className="text-[22px] text-wrap font-bold textColor">
                    {t("enter_verification_code")}
                  </h5>
                  <span className="flex flex-col text-start item-start ">
                    {t("otp_send_message")}
                    <p className="font-weight-bold py-2">
                      {inputType == "email" ? (
                        <div className="flex gap-2">
                          {t("email")}: {email}
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          {t("phone")}: {phoneNumber}
                        </div>
                      )}
                    </p>
                  </span>
                </div>
              ) : (
                <div className="flex flex-col ">
                  <h5 className="text-[40px] font-bold textColor">
                    {t("welcome")}
                  </h5>
                  {(setting?.email_login == 1 || setting?.phone_login == 1) && (
                    <span className="textColor text-xs">
                      {t("login_message")}
                    </span>
                  )}
                </div>
              )}
            </div>
            <div>
              {isOTP ? (
                <form
                  onSubmit={
                    inputType == "email"
                      ? handleEmailVerify
                      : handleOtpVerification
                  }
                >
                  <div className="overflow-auto p-0 flex items-center justify-center flex-col ">
                    <OtpInput
                      className=" mx-auto items-center flex flex-wrap justify-center p-0"
                      value={otp}
                      onChange={(val) => {
                        setOtp(val);
                        if (error) setError("");
                      }}
                      numInputs={6}
                      inputType="number"
                      renderInput={(props) => (
                        <input
                          {...props}
                          className="border border-gray-300 mx-1 md:mx-2 rounded-sm  bg text-center
                                      p-2 w-10 md:w-[62px] mt-6 "
                          style={{
                            fontSize: "16px",
                          }}
                        />
                      )}
                    />
                    {error ? (
                      <p className="text-center text-xs text-red-500 mt-2">
                        {error}
                      </p>
                    ) : (
                      <></>
                    )}
                  </div>
                  <div className="mt-8 flex justify-center ">
                    <button
                      className="w-full primaryBackColor text-white text-xl py-2 rounded-sm transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
                      type="submit"
                      disabled={loading || !otp || otp.length < 6}
                    >
                      {loading == true ? t("loading") : t("login")}
                    </button>
                  </div>
                  {inputType == "number" && (
                    <div className="mt-2 text-center">
                      <div className="text-base font-medium flex gap-1 justify-center my-2">
                        <button
                          type="button"
                          onClick={handleSendOTP}
                          disabled={otpDisabled}
                        >
                          {timer === 0 ? (
                            `Resend OTP`
                          ) : (
                            <>
                              {t("resetOtpIn")}{" "}
                              <strong> {formatTime(timer)} </strong>{" "}
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </form>
              ) : (
                <>
                  <div className="my-4 flex flex-col gap-2 ">
                    {setting?.email_login == 1 && setting?.phone_login == 1 ? (
                      inputType == "number" ? (
                        renderPhoneInput()
                      ) : (
                        renderEmailInput()
                      )
                    ) : setting?.phone_login == 1 ? (
                      renderPhoneInput()
                    ) : setting?.email_login == 1 ? (
                      renderEmailInput()
                    ) : (
                      <></>
                    )}
                  </div>

                  {setting?.google_login == 1 &&
                  (setting?.email_login == 1 || setting?.phone_login == 1) ? (
                    <div className="flex items-center justify-between my-4 gap-2">
                      <hr className="flex-grow border-t-2 border-dashed border-gray-300" />
                      <span className=" text-[#4B6272] font-bold text-base">
                        {t("or")}
                      </span>
                      <hr className="flex-grow border-t-2 border-dashed border-gray-300" />
                    </div>
                  ) : (
                    <></>
                  )}
                  {setting?.google_login == 1 && (
                    <div className="my-4">
                      <button
                        type="button"
                        onClick={handleGoogleLogin}
                        className="w-full border-[1px] py-2  px-4 rounded-sm  gap-2 flex items-center justify-center text-base font-normal"
                      >
                        <Image
                          src={GoogleLogo}
                          alt="Google logo"
                          height={30}
                          width={30}
                          className="h-[30px] w-[30px] object-cover "
                        />{" "}
                        {t("continue_with_google")}
                      </button>
                    </div>
                  )}
                  {setting?.email_login == 1 && inputType == "number" && (
                    <div className="my-4">
                      <button
                        type="button"
                        onClick={() => {
                          setError("");
                          setInputType("email");
                          setOtp(null);
                        }}
                        // onClick={handleGoogleLogin}
                        className="w-full border-[1px] py-2  px-4 rounded-sm  gap-2 flex items-center justify-center text-base font-normal"
                      >
                        <FaRegEnvelope
                          size={30}
                          className="h-[30px] w-[30px]"
                        />{" "}
                        {t("continue_with_email")}
                      </button>
                    </div>
                  )}
                  {setting?.phone_login == 1 && inputType == "email" && (
                    <div className="my-4">
                      <button
                        type="button"
                        onClick={() => {
                          setInputType("number");
                          setEmail("");
                          setPassword("");
                          setError("");
                          setTouched({ email: false, password: false });
                          setLoginRejected(false);
                        }}
                        className="w-full border-[1px] py-2  px-4 rounded-sm  gap-2 flex items-center justify-center text-base font-normal"
                      >
                        <FiPhone size={30} className="h-[30px] w-[30px]" />{" "}
                        {t("continue_with_phone")}
                      </button>
                    </div>
                  )}
                  <div className="py-6 flex items-center justify-center">
                    <p dir="auto" className="text-center leading-relaxed">
                      {t("agreement_updated_message")}{" "}
                      <bdi>{setting?.web_settings?.site_title}</bdi>{" "}
                      <Link
                        href={zoneHref("/terms-and-conditions")}
                        className="primaryColor underline hover:text-blue-800"
                      >
                        {t("terms_of_service")}
                      </Link>{" "}
                      {t("and")}{" "}
                      <Link
                        href={zoneHref("/privacy-policy")}
                        className="primaryColor underline hover:text-blue-800"
                      >
                        {t("privacy_policy")}
                      </Link>
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
          {/* Must stay on-screen (not hidden/display:none) — v2 challenge popup
              anchors here and needs to be visible/clickable, just scaled down. */}
          <div className="flex justify-center overflow-hidden">
            <div
              id="recaptcha-container"
              style={{ transform: "scale(0.85)", transformOrigin: "center" }}
            ></div>
          </div>
        </DialogContent>
      </Dialog>
      <NewUserModal
        showNewUser={showNewUser}
        // Closes the whole flow (not just this modal) on both success and dismiss.
        setShowNewUser={(value) => {
          setShowNewUser(value);
          if (!value) setShowLogin(false);
        }}
        setPhoneNumberWithoutCountryCode={setPhoneNumberWithoutCountryCode}
        setEmail={setEmail}
        setUserName={setUserName}
        userName={userName}
        email={email}
        phoneNumberWithoutCountryCode={phoneNumberWithoutCountryCode}
        countryCode={countryCode}
        setCountryCode={setCountryCode}
        setIsOTP={setIsOTP}
      />
      <Register
        setShowRegister={setShowRegister}
        showRegister={showRegister}
        setIsOTP={setIsOTP}
        email={email}
        setEmail={setEmail}
        setOtp={setOtp}
        inputType={inputType}
        setTimer={setTimer}
      />
      <ForgetPasswordModal
        showForgetPassword={showForgetPassword}
        setShowForgetPassword={setShowForgetPassword}
        forgotPasswordType={forgotPasswordType}
        isErrorMessage={isErrorMessage}
      />
    </>
  );
}

export default Login;
