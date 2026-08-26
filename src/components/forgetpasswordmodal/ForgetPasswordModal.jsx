import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { RiCloseFill } from "react-icons/ri";
import { t } from "@/utils/translation";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import * as api from "@/api/apiRoutes";
import { toast } from "react-toastify";
import PhoneNumberInput from "../phonenumberinput/PhoneNumberInput";
import { useSelector } from "react-redux";
import PasswordRules from "../passwordrules/PasswordRules";
import { useValidatePassword } from "@/utils/passwordValidation";
import { loadFirebaseAuth } from "@/utils/lazyFirebaseAuth";
import { getRecaptchaVerifier, clearRecaptchaVerifier } from "@/utils/recaptchaVerifier";

const ForgetPasswordModal = ({
  showForgetPassword,
  setShowForgetPassword,
  forgotPasswordType,
  isErrorMessage,
}) => {
  const language = useSelector((state) => state.Language.selectedLanguage);
  const setting = useSelector((state) => state.Setting.setting);
  const [stage, setStage] = useState(0);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  // First unmet rule from web_settings.password_*, or null. Derived rather than
  // stored so it re-evaluates on every keystroke without a second state update.
  const passwordPolicyError = useValidatePassword(password);
  const [loading, setLoading] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState(null);
  const [phoneNumberWithoutCountryCode, setPhoneNumberWithoutCountryCode] =
    useState("");

  // The RecaptchaVerifier itself is a single shared instance (see
  // src/utils/recaptchaVerifier.js) used by Login, Register, and this modal
  // alike — not one per component.
  //
  // Safety net for the close paths that bypass handleShowModal (the success
  // and error branches close the dialog directly). By the time this runs the
  // Dialog may already have unmounted the container — clearRecaptchaVerifier's
  // is-still-in-the-document guard is what keeps it from throwing.
  useEffect(() => {
    if (!showForgetPassword) clearRecaptchaVerifier();
  }, [showForgetPassword]);

  const handleOtpChange = (e) => {
    const value = e.target.value;
    if (/^\d{0,6}$/.test(value)) {
      setOtp(value);
    }
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
  };

  const handleEmailChange = (e) => {
    setEmail(e.target.value);
  };

  const handleConfirmPasswordChange = (e) => {
    setConfirmPassword(e.target.value);
  };
  const handleShowPassword = () => {
    setShowPassword(!showPassword);
  };

  const handleShowConfirmPassword = () => {
    setShowConfirmPass(!showConfirmPass);
  };

  const handleShowModal = () => {
    // Clear BEFORE closing: the Dialog unmounts its children on close, and the
    // verifier can only be torn down while its container is still in the DOM.
    clearRecaptchaVerifier();
    setStage(0);
    setLoading(false);
    setPhoneNumber(null);
    setEmail(null);
    setShowForgetPassword(false);
  };

  const handleForgetPassword = async (e) => {
    setLoading(true);
    e.preventDefault();
    try {
      const res = await api.forgotPasswordOTP({ email: email });
      if (res.status == 1) {
        setStage(1);
        toast.success(t("verification_mail_sent_successfully"));
        setLoading(false);
      } else {
        if (res.message == "email_is_not_registered") {
          toast.error(t("email_is_not_registered"));
          setLoading(false);
        } else {
          setLoading(false);
          toast.error(res.message);
        }
      }
    } catch (error) {
      setLoading(false);
      console.log("error", error);
    }
  };

  const handleSendOTP = async (e) => {
    e.preventDefault();
    // Re-entrancy guard: a fast double-click/double-Enter can fire this
    // twice before React re-renders the disabled button, racing two
    // getRecaptchaVerifier()/signInWithPhoneNumber calls against the same
    // container and verifier.
    if (loading) return;
    setLoading(true);
    // Validate the DIGITS, not string-length math against the dial code. The old
    // check compared `phoneNumber.slice(1)` ("91") with `countryCode` ("+91") —
    // never equal, because slice(1) strips the "+" the dial code still carries.
    // A dial-code-only value therefore passed the guard and was handed to
    // Firebase as "+91", which rejects it with an opaque invalid-phone error.
    if (!phoneNumberWithoutCountryCode?.trim()) {
      toast.error(t("please_enter_phone_number") || "Please enter phone number!");
      setLoading(false);
    } else {
      const phoneNumberWithoutSpaces = `${phoneNumber}`.replace(/\s+/g, "");
      if (setting?.firebase_authentication == 1) {
        try {
          const verifier = await getRecaptchaVerifier("forgot-recaptcha-container");
          if (!verifier) {
            toast.error(t("Something went wrong"));
            setLoading(false);
            return;
          }
          const { auth, signInWithPhoneNumber } = await loadFirebaseAuth();
          const confirmationResult = await signInWithPhoneNumber(
            auth,
            phoneNumberWithoutSpaces,
            verifier
          );
          window.confirmationResult = confirmationResult;
          // setTimer(90);
          setLoading(false);
          setStage(1);
        } catch (error) {
          console.log("error from send otp", error);
          // Drop the spent verifier — Firebase won't accept it for a retry.
          clearRecaptchaVerifier();
          setPhoneNumber("");
          toast.error(error?.message || t("custom_send_sms_error_message"));
          setLoading(false);
          // setIsOTP(false);
        }
      } else if (setting?.custom_sms_gateway_otp_based == 1) {
        try {
          const res = await api.sendSms({
            mobile: phoneNumberWithoutSpaces,
          });
          if (res?.status == 1) {
            setStage(1);
            setLoading(false);
          } else {
            toast.error(res?.message || t("custom_send_sms_error_message"));
            setLoading(false);
          }
        } catch (error) {
          setPhoneNumber("");
          toast.error(t("custom_send_sms_error_message"));
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
    if (otp == "") {
      toast.error(t("otp_required"));
      return;
    }
    if (setting?.firebase_authentication == 1) {
      setLoading(true);
      try {
        const user = await window.confirmationResult.confirm(otp);
        setLoading(false);
        return true;
      } catch (error) {
        setLoading(false);
        toast.error(t("invalid_otp"));
        return false;
      }
    } else if (setting?.custom_sms_gateway_otp_based == 1) {
      try {
        const response = await api.verifyOTP({
          mobile: phoneNumberWithoutCountryCode,
          // countryCode already carries its "+" (dial_code is "+91"), so the
          // old `+${countryCode}` template produced "++91".
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
        console.log("error", error);
      }
    }
  };

  const handleEmailResetPassword = async (e) => {
    setLoading(true);
    e.preventDefault();
    try {
      if (passwordPolicyError) {
        // Length/complexity rules come from web_settings.password_*.
        toast.error(passwordPolicyError);
        setLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        toast.error(t("confirm_password_message"));
        setLoading(false);
        return;
      }
      const res = await api.forgotPassword({
        email: email,
        otp: otp,
        password: password,
        confirmPassword: confirmPassword,
        type: forgotPasswordType,
      });
      if (res.status == 1) {
        setConfirmPassword("");
        setOtp("");
        setPassword("");
        setEmail("");
        setShowForgetPassword(false);
        toast.success(res.message);
        setStage(0);
        setLoading(false);
      } else {
        setLoading(false);
        setStage(1);
        toast.error(res.message);
      }
    } catch (error) {
      setLoading(false);
      console.log("error", error);
    }
  };

  // Single source of truth from PhoneNumberInput: it hands back the dial code,
  // the bare digits and the composed number already separated, so nothing here
  // has to slice "+" prefixes off strings (the old react-international-phone
  // handler did, and got it subtly wrong).
  const handlePhoneNoChange = ({ dialCode, rawPhone, fullNumber }) => {
    setCountryCode(dialCode || "");
    setPhoneNumberWithoutCountryCode(rawPhone || "");
    setPhoneNumber(fullNumber || "");
  };

  // The country list loads async; seed the dial code once it resolves so a
  // submit before the first keystroke still carries the right country.
  const handleCountryReady = (country) => {
    setCountryCode(country?.dial_code || "");
  };

  const verifyUser = async (e) => {
    e.preventDefault();
    // Stop an empty field here: verify_user_exist answers a blank mobile with
    // status 0 ("The mobile field is required"), which would otherwise surface
    // as the misleading "no account found" message below.
    if (!phoneNumberWithoutCountryCode?.trim()) {
      toast.error(t("please_enter_phone_number") || "Please enter phone number!");
      return;
    }
    try {
      const res = await api.verifyUserByPhoneNum({
        mobile: phoneNumberWithoutCountryCode,
        countryCode: countryCode,
        type: "phone",
      });
      // Gate on `status`, NOT on the message text. verify_user_exist returns a
      // human string ("User already exists" / "User does not exist"), so the old
      // comparison against the snake_case key "user_already_exist" was never
      // true — every lookup fell through to the error branch and the
      // forgot_password call was never reached.
      //
      // status 1 = the account EXISTS, which is precisely when a password reset
      // should proceed (including for an OTP-registered account that has no
      // password yet — that's the case this flow is for).
      if (res?.status == 1) {
        handleSendOTP(e);
      } else {
        setShowForgetPassword(false);
        setPhoneNumber("");
        toast.error(t("user_not_exist_message") || res?.message);
      }
    } catch (error) {
      console.log("error", error);
    }
  };

  const handleMobilePasswordChange = async (e) => {
    setLoading(true);
    e.preventDefault();
    try {
      if (passwordPolicyError) {
        // Length/complexity rules come from web_settings.password_*.
        toast.error(passwordPolicyError);
        setLoading(false);
        return;
      }
      if (password !== confirmPassword) {
        toast.error(t("confirm_password_message"));
        setLoading(false);
        return;
      }
      const otpRes = await handleOtpVerification(e);
      if (otpRes == false) {
        toast.error(t("invalid_otp"));
        setLoading(false);
        setPassword("");
        setConfirmPassword("");
        return;
      }
      const res = await api.forgotPassword({
        phone: phoneNumberWithoutCountryCode,
        // otp was omitted here, so apiRoutes appended the STRING "undefined"
        // (FormData stringifies whatever it gets) and the backend rejected it.
        // Firebase has already verified the code by this point — the backend
        // still wants it echoed back alongside otp_verify_method.
        otp: otp,
        otpMethod: "firebase",
        type: forgotPasswordType,
        password: password,
        confirmPassword,
      });
      if (res.status == 1) {
        toast.success(res.message);
        setOtp(null);
        setPassword("");
        setConfirmPassword("");
        setShowForgetPassword(false);
        setStage(0);
      } else {
        toast.error(res.message);
        setOtp(null);
        setPassword("");
        setConfirmPassword("");
        setShowForgetPassword(false);
        setStage(0);
      }
    } catch (error) {
      console.log("error", error);
    }
  };

  const handleResetPassword = async (e) => {
    if (forgotPasswordType == "email") {
      handleEmailResetPassword(e);
    } else {
      handleMobilePasswordChange(e);
    }
  };

  return (
    <Dialog open={showForgetPassword}>
      <DialogContent title={t("forget_password")}>
        <DialogHeader className="flex justify-between items-center flex-row">
          <h1 className="font-bold text-xl">{t("forget_password")}</h1>
          <div className="closeButtonBg rounded-full p-[8px] cursor-pointer">
            <RiCloseFill size={22} onClick={() => handleShowModal()} />
          </div>
        </DialogHeader>
        <div>
          {stage == 0 ? (
            <div className="flex flex-col w-full gap-4">
              <div className="flex flex-col gap-1">
                {isErrorMessage && (
                  <p className="text-red-500 font-semibold text-sm">
                    {t("forget_password_note")}
                  </p>
                )}
                {forgotPasswordType == "email" ? (
                  <>
                    {" "}
                    <label htmlFor="email" className="font-semibold">
                      {t("email")}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      id="email"
                      placeholder={t("emailPlaceholder")}
                      className="p-2 cardBorder rounded-sm outline-none"
                      value={email}
                      onChange={handleEmailChange}
                    />
                  </>
                ) : (
                  <>
                    <PhoneNumberInput
                      value={phoneNumberWithoutCountryCode}
                      onChange={handlePhoneNoChange}
                      onCountryReady={handleCountryReady}
                      autoFocus
                    />
                  </>
                )}
              </div>
              {forgotPasswordType == "email" ? (
                <button
                  className="primaryBackColor rounded-sm text-white font-medium text-base py-2 "
                  onClick={handleForgetPassword}
                  disabled={loading}
                >
                  {loading ? t("loading") : t("get_mail")}
                </button>
              ) : (
                <button
                  className="primaryBackColor rounded-sm text-white font-medium text-base py-2 "
                  onClick={verifyUser}
                  disabled={loading}
                >
                  {loading ? t("loading") : t("verify_user")}
                </button>
              )}
            </div>
          ) : (
            <div className="flex flex-col w-full gap-4">
              <div className="flex flex-col gap-2">
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-base">
                    {t("otp")}
                    <span className="text-red-500">*</span>
                  </span>
                  <div className="">
                    <input
                      type="number"
                      aria-label={t("otp")}
                      inputMode="numeric"
                      pattern="\d*"
                      className="py-2 px-4 cardBorder outline-none rounded-sm w-full"
                      placeholder={t("otpPlaceholder")}
                      value={otp}
                      onChange={handleOtpChange}
                      maxLength={6}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-bold text-base">
                    {t("password")}
                    <span className="text-red-500">*</span>
                  </span>
                  <div className="relative w-full ">
                    <input
                      type={showPassword ? "text" : "password"}
                      aria-label={t("password")}
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
                      {showPassword ? <FaEyeSlash /> : <FaEye />}
                    </button>
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
                      aria-label={t("confirmPassword")}
                      className="py-2 px-4 cardBorder outline-none rounded-sm w-full"
                      placeholder={t("please_enter_confirm_password")}
                      value={confirmPassword}
                      onChange={handleConfirmPasswordChange}
                    />
                    <button
                      type="button"
                      aria-label="Toggle password visibility"
                      className="absolute right-3 top-3"
                      onClick={handleShowConfirmPassword}
                    >
                      {showConfirmPass ? <FaEyeSlash /> : <FaEye />}
                    </button>
                  </div>
                </div>
                <button
                  className="primaryBackColor rounded-sm text-white font-medium text-base py-2"
                  onClick={handleResetPassword}
                  disabled={loading}
                >
                  {loading ? t("loading") : t("reset_password")}
                </button>
              </div>
            </div>
          )}
          {/* Own container id — "recaptcha-container" is Login's, and while both
              are mounted getElementById would hand us Login's element.
              Must stay on-screen/in-flow — see Login.jsx's container comment.
              Off-screen/hidden silently breaks the v2 fallback challenge
              popup whenever Enterprise init fails. Scaled down (not
              clipped/hidden) so Google's ~256px badge/challenge iframe stays
              fully mounted and clickable without overflowing the dialog. */}
          <div className="flex justify-center overflow-hidden">
            <div
              id="forgot-recaptcha-container"
              style={{ transform: "scale(0.85)", transformOrigin: "center" }}
            ></div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ForgetPasswordModal;
