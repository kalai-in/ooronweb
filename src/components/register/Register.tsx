import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { t } from "@/utils/translation";
import useZoneHref from "@/hooks/useZoneHref";
import PhoneNumberInput from "../phonenumberinput/PhoneNumberInput";
import CountrySelect from "../phonenumberinput/CountrySelect";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { RiCloseFill } from "react-icons/ri";
import * as api from "@/api/apiRoutes";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";
import { setAuthType } from "@/redux/slices/userSlice";
import PasswordRules from "../passwordrules/PasswordRules";
import { useValidatePassword } from "@/utils/passwordValidation";
import { loadFirebaseAuth } from "@/utils/lazyFirebaseAuth";
import { getRecaptchaVerifier, clearRecaptchaVerifier } from "@/utils/recaptchaVerifier";

interface RegisterProps {
  showRegister: boolean;
  setShowRegister: (value: boolean) => void;
  setIsOTP: (value: boolean) => void;
  email: string;
  setEmail: (value: string) => void;
  inputType: string;
  // Login also passes setOtp/setTimer, but the original component never
  // destructured them (pre-existing behavior, preserved as-is) — declared
  // here as optional/unknown so passing them from Login stays a non-error.
  setOtp?: unknown;
  setTimer?: unknown;
}

interface CountryOption {
  id?: number | string;
  dial_code?: string;
}

interface PhoneChangePayload {
  dialCode: string;
  rawPhone: string;
  fullNumber: string;
  lengthError?: string | null;
}

interface CountryReadyPayload {
  dial_code?: string;
}

const Register = ({
  showRegister,
  setShowRegister,
  setIsOTP,
  email,
  setEmail,
  inputType,
}: RegisterProps) => {
  const zoneHref = useZoneHref();
  const dispatch = useDispatch();
  const fcmToken = useSelector((state: any) => state.User?.fcm_token);
  const setting = useSelector((state: any) => state.Setting.setting);


  const [name, setName] = useState("");
  // Account country (country_id), separate from the phone dial-code picker.
  const [defaultCountry, setDefaultCountry] = useState<CountryOption | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [rawPhone, setRawPhone] = useState("");
  const [phoneNumberWithoutCountryCode, setPhoneNumberWithoutCountryCode] =
    useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  // First unmet password rule from web_settings.password_*, or null.
  const passwordPolicyError = useValidatePassword(password);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [errorType, setErrorType] = useState("");
  const [isPhoneOtp, setIsPhoneOtp] = useState(false);
  const [otp, setOtp] = useState<string | null>("");
  const [friendCode, setFriendCode] = useState("");
  // countries API's is_referal_on flag — gates the friend code field.
  const [isReferralOn, setIsReferralOn] = useState(false);
  // Per-country min-length verdict from PhoneNumberInput; gates OTP submit.
  const [phoneLengthError, setPhoneLengthError] = useState<string | null>(null);

  // RecaptchaVerifier is a single shared instance across Login/Register/ForgetPassword.
  const registerConfirmationResultRef = useRef<any>(null);

  // Safety net for close paths that bypass handleCloseRegister.
  useEffect(() => {
    if (!showRegister) {
      clearRecaptchaVerifier();
      registerConfirmationResultRef.current = null;
    }
  }, [showRegister]);

  const handleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleFriendCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFriendCode(e.target.value);
  };

  const handleShowConfirmPassword = () => {
    setShowConfirmPass(!showConfirmPass);
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setName(e.target.value);
  };

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
  };
  const handleConfirmPasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
  };

  const handleCountryReady = (country: CountryReadyPayload) => {
    setCountryCode(country?.dial_code || "");
  };

  const handlePhoneNumberChange = ({ dialCode, rawPhone: digits, fullNumber, lengthError }: PhoneChangePayload) => {
    setRawPhone(digits);
    setPhoneLengthError(lengthError ?? null);
    setCountryCode(dialCode);
    setPhoneNumberWithoutCountryCode(digits);
    setPhoneNumber(fullNumber);
  };

  const handleUserRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    // Email format enforced by input's type="email" + required (browser blocks submit).
    try {
      if (!name) {
        setError(t("please_enter_name"));
        setErrorType("name");
        return;
      } else if (!defaultCountry?.id) {
        setError(t("please_select_country"));
        setErrorType("country");
        return;
        // Phone required only for number signup; email signup makes it optional.
      } else if (inputType == "number" && !rawPhone) {
        setError(t("please_enter_phone_number"));
        setErrorType("phone");
        return;
        // An optional number, if typed, still must be valid length (blank stays allowed).
      } else if (phoneLengthError) {
        setError(phoneLengthError);
        setErrorType("phone");
        return;
      } else if (!password) {
        setError(t("please_enter_password"));
        setErrorType("password");
        return;
      } else if (passwordPolicyError) {
        setError(passwordPolicyError);
        setErrorType("password");
        return;
      } else if (!confirmPassword) {
        setError(t("please_enter_confirm_password"));
        setErrorType("confirmpassword");
        return;
      } else if (confirmPassword !== password) {
        setError(t("confirm_password_message"));
        setErrorType("confirmpassword");
        return;
      } else if (inputType == "number") {
        await handleSendOTP(e);
        setError("");
        setErrorType("");
      } else {
        await handleEmailRegister(e);
      }
    } catch (error) {
      console.log("error", error);
    }
  };

  const handleMobileRegister = async (e: React.FormEvent) => {
    // Must run before the first await, or the form submits and reloads the page.
    e.preventDefault();
    const otpRes = await handleOtpVerification(e);
    if (!otpRes) {
      toast.error(t("invalid_otp"));
      return;
    }
    setIsLoading(true);
    try {
      const res = await api.registerUser({
        id: phoneNumberWithoutCountryCode,
        name: name,
        email: email,
        mobile: phoneNumberWithoutCountryCode,
        type: "phone",
        country_code: countryCode,
        country_id: defaultCountry?.id,
        password: password,
        fcm: fcmToken,
        phoneAuthType: true,
      });
      if (res?.status == 1) {
        toast.success(t("succesfull_register_message"));
        handleCloseRegister();
        setIsLoading(false);
      } else {
        clearRecaptchaVerifier();
        registerConfirmationResultRef.current = null;
        setIsLoading(false);
        toast.error(translateOrRaw(res?.message));
        setShowRegister(false);
        setIsPhoneOtp(false);
        setOtp(null);
        setPassword("");
        setConfirmPassword("");
        setPhoneNumber("");
        setPhoneNumberWithoutCountryCode("");
        setName("");
        setEmail("");
      }
    } catch (error) {
      console.log("error", error);
    }
  };

  // Maps raw Firebase phone-auth error codes to friendly translated copy.
  const friendlyPhoneAuthError = (error: any): string => {
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

  const handleSendOTP = async (e: React.FormEvent | React.MouseEvent) => {
    e.preventDefault();
    // Re-entrancy guard: blocks double-click racing two OTP sends.
    if (isLoading) return;
    setIsLoading(true);
    if (!rawPhone?.trim()) {
      setError(t("please_enter_phone_number"));
      setErrorType("phone");
      setIsLoading(false);
    } else if (phoneLengthError) {
      // Under min_mobile_length — stop before burning an OTP the backend would reject.
      setError(phoneLengthError);
      setErrorType("phone");
      setIsLoading(false);
    } else {
      const phoneNumberWithoutSpaces = `${phoneNumber}`.replace(/\s+/g, "");
      if (setting?.firebase_authentication == 1) {
        try {
          const verifier = await getRecaptchaVerifier("register-recaptcha-container");
          if (!verifier) {
            setError(t("Something went wrong"));
            setErrorType("phone");
            setIsLoading(false);
            return;
          }
          const { auth, signInWithPhoneNumber } = await loadFirebaseAuth();
          // Timeout guard: a stuck v2 challenge otherwise hangs forever with no error.
          const confirmationResult = await Promise.race([
            signInWithPhoneNumber(auth, phoneNumberWithoutSpaces, verifier),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("otp-send-timeout: signInWithPhoneNumber did not settle in 20s")),
                20000,
              ),
            ),
          ]);
          registerConfirmationResultRef.current = confirmationResult;
          setIsLoading(false);
          setIsPhoneOtp(true);
          // Not setShowLogin(false): that unmounts <Login>, taking <Register>
          // (a sibling inside it) down with it right as the OTP screen should show.
          // Register's visibility is controlled entirely by its own showRegister prop.
        } catch (error: any) {
          console.log("[otp] send failed:", error?.code, error?.message, error);
          // Spent verifier can't be reused — clear it so retry gets a fresh one.
          clearRecaptchaVerifier();
          setError(friendlyPhoneAuthError(error));
          setErrorType("phone");
          console.log("error", error);
          setIsLoading(false);
          setIsPhoneOtp(false);
        }
      } else if (setting?.custom_sms_gateway_otp_based == 1) {
        try {
          const res = await api.sendSms({
            mobile: phoneNumberWithoutSpaces,
          });
          if (res?.status == 1) {
            // setTimer(90);
            setIsPhoneOtp(true);
            setIsLoading(false);
          } else {
            setError(t("custom_send_sms_error_message"));
            setIsLoading(false);
          }
        } catch (error: any) {
          console.log("[otp] send failed:", error?.code, error?.message, error);
          setError(t("custom_send_sms_error_message"));
          setIsLoading(false);
        }
      } else {
        toast.error(t("Something went wrong"));
        setIsLoading(false);
      }
    }
  };

  const handleOtpVerification = async (e: React.FormEvent): Promise<boolean | undefined> => {
    e.preventDefault();
    if (otp == "") {
      toast.error(t("otp_required"));
      return;
    }
    if (setting?.firebase_authentication == 1) {
      setIsLoading(true);
      try {
        await registerConfirmationResultRef.current.confirm(otp);
        setIsLoading(false);
        return true;
      } catch (error: any) {
        // Logs the real Firebase error instead of a blanket "invalid OTP".
        console.log("otp verify error", error?.code, error?.message, error);
        setIsLoading(false);
        return false;
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
          response?.message ==
          "OTP is valid, but no user found with this phone number."
        ) {
          return false;
        } else if (response?.status == 1) {
          return true;
        } else {
          return false;
        }
      } catch (error) {
        console.log("otp verify error", error);
        setIsLoading(false);
        return false;
      }
    }
  };

  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsLoading(true);
      const res = await api.registerUser({
        id: email,
        name: name,
        email: email,
        mobile: phoneNumberWithoutCountryCode,
        type: "email",
        country_code: countryCode,
        country_id: defaultCountry?.id,
        password: password,
        fcm: fcmToken,
        friend_code: friendCode,
      });
      if (res.status == 1) {
        setIsLoading(false);
        dispatch(setAuthType({ data: "email" }));
        setShowRegister(false);
        toast.success(translateOrRaw(res?.message));
        setIsOTP(true);
        setOtp("");
        // setTimer(90)
        setPassword("");
        setName("");
        setPhoneNumberWithoutCountryCode("");
        setConfirmPassword("");
        setPhoneNumber("");
        setFriendCode("");
      } else if (res.message == "user_exist_with_email") {
        handleResponseError(res.message);
      } else if (res.message == "email_not_verified") {
        handleResponseError(res.message);
      } else if (res.message == "user_exist_with_google") {
        handleResponseError(res.message);
      } else if (res.message == "mobile_number_already_taken") {
        handleResponseError(res.message);
      } else {
        handleResponseError(res.message);
      }
    } catch (error: any) {
      // Surfaces the failure instead of leaving the button spinning silently.
      console.log("error", error);
      setIsLoading(false);
      toast.error(
        error?.response?.data?.message || t("something_went_wrong")
      );
    }
  };

  // message may be a translation key or a raw server sentence; use the
  // translation only if it resolves, else show the server text as-is.
  const translateOrRaw = (message: string | null | undefined): string => {
    if (!message) return t("something_went_wrong");
    const translated = t(message);
    return translated || message;
  };

  // Unwinds loading/modal state only — keeps form fields so the user can retry.
  const handleResponseError = (errorMessage: string | null | undefined) => {
    toast.error(translateOrRaw(errorMessage));
    setShowRegister(false);
    setIsLoading(false);
  };

  const handleOtpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    // Digits only, max 6 chars.
    const cleanedInput = input.replace(/\D/g, "").slice(0, 6);
    setOtp(cleanedInput);
  };

  const handleCloseRegister = (e?: React.MouseEvent) => {
    clearRecaptchaVerifier();
    registerConfirmationResultRef.current = null;
    setName("");
    setEmail("");
    setPhoneNumber("");
    setOtp(null);
    setIsPhoneOtp(false);
    setPassword("");
    setConfirmPassword("");
    setFriendCode("");
    setDefaultCountry(null);
    setShowRegister(false);
    setIsLoading(false);
  };

  return (
    <Dialog open={showRegister}>
      <DialogContent
        className="overflow-y-auto max-h-[90%]"
        title={t("register")}
      >
        <DialogHeader className="flex justify-between flex-row items-center">
          <div className="">
            <h1 className="text-3xl font-bold">{t("register")}</h1>
            {/* <Image src={setting?.web_settings?.web_logo} alt="logo" fill className="aspect-square w-full h-full object-cover" /> */}
          </div>
          <div className="closeButtonBg rounded-full p-[8px] gap-[4px]">
            <RiCloseFill size={22} onClick={handleCloseRegister} />
          </div>
        </DialogHeader>
        {/* Real <form> so the browser runs native validation before submit. */}
        <form onSubmit={isPhoneOtp ? handleMobileRegister : handleUserRegister}>
          <div className="flex flex-col ">
            <h5 className="text-[34px] font-bold textColor">{t("welcome")}</h5>
            <span className="textColor text-xs">{t("signupMessage")}</span>
          </div>
          {isPhoneOtp ? (
            <div className="flex flex-col gap-1">
              <span className="font-bold text-base">
                {t("otp")}
                <span className="text-red-500">*</span>
              </span>
              <div className="">
                <input
                  type="text"
                  aria-label={t("otp")}
                  className="py-2 px-4 cardBorder outline-none rounded-sm w-full"
                  placeholder={t("otpPlaceholder")}
                  value={otp ?? ""}
                  onChange={handleOtpChange}
                  pattern="[0-9]*"
                  inputMode="numeric"
                  maxLength={6}
                />
              </div>
            </div>
          ) : (
            <div className="mt-8 flex flex-col gap-2">
              <div className="flex flex-col gap-1">
                <span className="font-bold text-base">
                  {t("name")}
                  <span className="text-red-500">*</span>
                </span>
                <input
                  type="text"
                  aria-label={t("name")}
                  className="py-2 px-4 cardBorder outline-none rounded-sm"
                  placeholder={t("please_enter_name")}
                  value={name}
                  onChange={handleUsernameChange}
                />
                {error && errorType == "name" && (
                  <span className="text-xs text-red-500">{error}</span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-bold text-base">
                  {t("email")}
                  {inputType == "email" ? (
                    <span className="text-red-500">*</span>
                  ) : (
                    <></>
                  )}
                </span>
                <input
                  type="email"
                  required={inputType == "email"}
                  aria-label={t("email")}
                  className="py-2 px-4 cardBorder outline-none rounded-sm"
                  placeholder={t("please_enter_email")}
                  value={email}
                  onChange={handleEmailChange}
                />
                {error && errorType == "email" && (
                  <span className="text-xs text-red-500">{error}</span>
                )}
              </div>
              <div className="flex flex-col gap-1 pl-0">
                <span className="font-bold text-base">
                  {t("country") || "Country"}
                  <span className="text-red-500">*</span>
                </span>
                <CountrySelect
                  value={defaultCountry?.id}
                  onChange={setDefaultCountry}
                  onReady={setDefaultCountry}
                  onReferralStatus={setIsReferralOn}
                />
                {error && errorType == "country" && (
                  <span className="text-xs text-red-500">{error}</span>
                )}
              </div>
              <div className="flex flex-col gap-1 pl-0">
                <span className="font-bold text-base">
                  {t("mobileNumber")}
                  {inputType == "number" && (
                    <span className="text-red-500">*</span>
                  )}
                </span>
                <PhoneNumberInput
                  value={rawPhone}
                  onChange={handlePhoneNumberChange}
                  onCountryReady={handleCountryReady}
                  hasError={!!error && errorType == "phone"}
                />
                {error && errorType == "phone" && (
                  <span className="text-xs text-red-500">{error}</span>
                )}
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-bold text-base">
                  {t("password")}
                  <span className="text-red-500">*</span>
                </span>
                <div className="relative w-full ">
                  <input
                    type={showPassword ? "text" : "password"}
                    name=""
                    id=""
                    className="py-2 px-4 cardBorder outline-none rounded-sm w-full"
                    placeholder={t("please_enter_password")}
                    value={password}
                    onChange={handlePasswordChange}
                  />
                  <button
                    type="button"
                    aria-label="Toggle password visibility"
                    className="absolute right-3 top-3"
                    onClick={handleShowPassword}
                  >
                    {showPassword ? <FaEye /> : <FaEyeSlash />}
                  </button>
                  {error && errorType == "password" && (
                    <span className="text-xs text-red-500">{error}</span>
                  )}
                </div>
                <PasswordRules password={password} />
              </div>
              <div className="flex flex-col gap-1">
                <span className="font-bold text-base">
                  {t("confirmPassword")}
                  <span className="text-red-500">*</span>
                </span>
                <div className="relative w-full ">
                  <input
                    type={showConfirmPass ? "text" : "password"}
                    name=""
                    id=""
                    className="py-2 px-4 cardBorder outline-none rounded-sm w-full"
                    placeholder={t("please_enter_confirm_password")}
                    value={confirmPassword}
                    onChange={handleConfirmPasswordChange}
                  />
                  <button
                    type="button"
                    aria-label="Toggle confirm password visibility"
                    className="absolute right-3 top-3"
                    onClick={handleShowConfirmPassword}
                  >
                    {showConfirmPass ? <FaEye /> : <FaEyeSlash />}
                  </button>
                  {error && errorType == "confirmpassword" && (
                    <span className="text-xs text-red-500">{error}</span>
                  )}
                </div>
              </div>
              {isReferralOn && (
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-base">{t("friend_code")}</span>
                  <input
                    type="text"
                    name=""
                    id=""
                    className="py-2 px-4 cardBorder outline-none rounded-sm disabled:text-gray-400"
                    placeholder={t("friend_code")}
                    value={friendCode}
                    onChange={handleFriendCodeChange}
                  />
                </div>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-col justify-center text-center gap-3">
            {isPhoneOtp ? (
              <button
                type="submit"
                className="primaryBackColor py-2 px-4 text-white text-center rounded-sm text-xl font-normal transition-opacity hover:opacity-90 disabled:opacity-60"
                disabled={isLoading}
              >
                {isLoading ? t("loading") : t("register")}
              </button>
            ) : (
              <button
                type="submit"
                className="primaryBackColor py-2 px-4 text-white text-center rounded-sm text-xl font-normal transition-opacity hover:opacity-90 disabled:opacity-60"
                disabled={isLoading}
              >
                {isLoading ? t("loading") : t("verify")}
              </button>
            )}
            <span className="text-base font-medium">
              {t("alreadyHaveAnAccount")}{" "}
              <button
                type="button"
                className="primaryColor underline ml-[2px] cursor-pointer"
                onClick={handleCloseRegister}
              >
                {t("signIn")}
              </button>
            </span>
          </div>
          {/* NOTE: Remove this becuase of copy of functionality  */}
          {/* <div className="flex items-center justify-between my-4 gap-2">
            <hr className="flex-grow border-t-2 border-dashed border-gray-300" />
            <span className=" text-[#4B6272] font-bold text-base">
              {t("or")}
            </span>
            <hr className="flex-grow border-t-2 border-dashed border-gray-300" />
          </div>
          <div className="my-4">
            <button className="w-full border-[1px] py-2  px-4 rounded-sm  gap-2 flex items-center justify-center text-base font-normal">
              <Image
                src={GoogleLogo}
                alt="Google logo"
                height={30}
                width={30}
                className="h-[30px] w-[30px] object-cover "
              />{" "}
              {t("continue_with_google")}
            </button>
          </div> */}
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
        </form>
        {/* Must stay on-screen (not hidden/display:none) — v2 challenge popup
            anchors here and needs to be visible/clickable, just scaled down. */}
        <div className="flex justify-center overflow-hidden">
          <div
            id="register-recaptcha-container"
            style={{ transform: "scale(0.85)", transformOrigin: "center" }}
          ></div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Register;
