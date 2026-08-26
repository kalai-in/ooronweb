import React, { useState, useEffect, useCallback } from "react";
import { t } from "@/utils/translation";
import Image from "next/image";
import {
  FiLock,
  FiCamera,
  FiUser,
  FiMail,
  FiTrash2,
  FiLoader,
  FiCheck,
  FiSmartphone,
} from "react-icons/fi";
import PhoneNumberInput from "../phonenumberinput/PhoneNumberInput";
import { useSelector } from "react-redux";
import DeleteModal from "../deleteModal/DeleteModal";
import ResetPasswordModal from "./ResetPasswordModal";
import * as api from "@/api/apiRoutes";
import { setCurrentUser } from "@/redux/slices/userSlice";
import { useDispatch } from "react-redux";
import { toast } from "react-toastify";
import CountrySelect from "../phonenumberinput/CountrySelect";
import useDir from "@/hooks/useDir";

const validateName = (name) => {
  const val = (name || "").trim();
  if (!val) return t("name_is_required");
  if (val.length < 2) return t("name_min_length");
  if (!/^[a-zA-Z\s]+$/.test(val))
    return t("name_can_contain_only_letters_and_spaces");
  return "";
};

const validateEmail = (email) => {
  const val = (email || "").trim();
  if (!val) return t("email_is_required");
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regex.test(val)) return t("enter_a_valid_email_address");
  return "";
};

// Phone-auth accounts registered with a mobile number, so email is optional.
// Empty is fine; a non-empty value must still be a valid address.
const validateOptionalEmail = (email) => {
  const val = (email || "").trim();
  if (!val) return "";
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regex.test(val)) return t("enter_a_valid_email_address");
  return "";
};

const validateImage = (file) => {
  if (!file) return "";
  const allowedTypes = ["image/jpeg", "image/png"];
  if (!allowedTypes.includes(file.type))
    return t("only_jpg_or_png_images_are_allowed");
};

const Profile = () => {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.User.user);
  const authType = useSelector((state) => state.User.authType);
  const setting = useSelector((state) => state?.Setting?.setting);
  const language = useSelector((state) => state.Language.selectedLanguage);
  const dir = useDir();
  const city = useSelector((state) => state.City.city);

  const [username, setUsername] = useState(user?.name);
  const [email, setEmail] = useState(user?.email);
  // `mobileNumber` = digits only (no dial code), validated + saved as before.
  const [mobileNumber, setMobileNumber] = useState(user?.mobile);
  // `phoneNumber` = full value the PhoneInput shows ("+91..."); `countryCode`
  // = "+<dial>" sent in the update payload.
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState(user?.country_code || "");
  const [countryId, setCountryId] = useState(user?.country_id || "");
  const [profileImage, setProfileImage] = useState(null);
  const [isChanged, setIsChanged] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState({});
  // Per-country length verdict from PhoneNumberInput (min/max_mobile_length on
  // the selected country), replacing the old hardcoded 6-16 digit regex. Null
  // for an empty value, so the field stays optional.
  const [phoneLengthError, setPhoneLengthError] = useState(null);
  const [showDelete, setShowDelete] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing local form state from the user prop
    setUsername(user?.name);
    setEmail(user?.email);
    setMobileNumber(user?.mobile);
    setCountryCode(user?.country_code || "");
    setCountryId(user?.country_id || "");
    // Seed the PhoneInput with the saved dial code + national number so the
    // flag/code render correctly on load.
    const dial = (user?.country_code || "").replace(/^\+/, "");
    setPhoneNumber(`+${dial}${user?.mobile || ""}`);
  }, [user]);

  const handlePhoneChange = ({
    dialCode,
    rawPhone,
    fullNumber,
    lengthError,
  }) => {
    setPhoneLengthError(lengthError ?? null);
    setCountryCode(dialCode);
    setMobileNumber(rawPhone);
    setPhoneNumber(fullNumber);
  };

  const handleDelete = () => {
    if (user?.balance > 0) {
      toast.error(t("withdraw_it_before_deleting"));
      return;
    }
    setShowDelete(true);
  };

  const checkIfChecked = useCallback(() => {
    if (
      username !== user?.name ||
      email !== user?.email ||
      mobileNumber !== user?.mobile ||
      countryCode !== (user?.country_code || "") ||
      countryId !== (user?.country_id || "") ||
      profileImage
    ) {
      setIsChanged(true);
    } else {
      setIsChanged(false);
    }
  }, [
    username,
    email,
    mobileNumber,
    countryCode,
    countryId,
    profileImage,
    user,
  ]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- derives isChanged from multiple form fields vs. user prop
    checkIfChecked();
  }, [checkIfChecked]);

  const onImageChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      setProfileImage(file);
    }
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    const newErrors = {
      name: validateName(username),
      email:
        authType === "google" || authType === "email"
          ? ""
          : authType === "phone"
            ? validateOptionalEmail(email)
            : validateEmail(email),
      // Optional for email/Google accounts: an empty number produces no
      // lengthError, a typed one must fit the selected country's bounds.
      mobile: authType === "phone" ? "" : phoneLengthError || "",
      image: validateImage(profileImage),
    };

    Object.keys(newErrors).forEach(
      (key) => !newErrors[key] && delete newErrors[key],
    );

    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }

    setErrors({});
    setIsSaving(true);
    try {
      const response = await api.updateProfile({
        name: username,
        email: email,
        mobileNumber: mobileNumber,
        countryCode: countryCode || user?.country_code,
        countryId: countryId || user?.country_id,
        image: profileImage,
        type: authType,
        latitude: city?.latitude,
        longitude: city?.longitude,
      });
      if (response?.status == 1) {
        const user = await api.getUser({
          latitude: city?.latitude,
          longitude: city?.longitude,
        });
        dispatch(setCurrentUser({ data: user?.data }));
        toast.success(response.message);
      } else {
        toast.error(response.message);
      }
    } catch (error) {
      console.log(("Error", error));
      toast.error("Something went wrong");
    } finally {
      setIsSaving(false);
    }
  };

  const emailLocked = authType == "google" || authType == "email";
  const mobileLocked = authType == "phone";

  // Required-field validity — mirrors handleProfileUpdate's checks (skips the
  // fields that are locked/auto-filled per auth type). Drives the submit button.
  const isFormValid =
    !validateName(username) &&
    (authType === "google" ||
      authType === "email" ||
      (authType === "phone"
        ? !validateOptionalEmail(email)
        : !validateEmail(email))) &&
    (authType === "phone" || !phoneLengthError) &&
    !validateImage(profileImage);

  const inputClass = (hasError, locked) =>
    `block w-full rounded-xl border py-2.5 pl-10 pr-4 text-sm outline-none transition-all duration-200 placeholder:text-gray-400 text-start bg-gray-50/70 dark:bg-zinc-800/60 ${
      hasError
        ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-500/20"
        : "cardBorder focus:primaryColorBorder focus:ring-2 focus:ring-[var(--primary-color,#29363f)]/15"
    } ${locked ? "cursor-not-allowed text-gray-400 dark:text-gray-500 opacity-70" : "textColor"}`;

  // Header identifier: email when the account has one, else the mobile number.
  // A phone-signup account has no email at all, so preferring email
  // unconditionally left the line showing a bare em-dash.
  const headerEmail = email || user?.email || "";
  const headerMobile = mobileNumber || user?.mobile || "";
  const headerDial = countryCode || user?.country_code || "";
  const contactLine = headerEmail
    ? {
        icon: <FiMail className="shrink-0 text-gray-400" size={14} />,
        value: headerEmail,
        isPhone: false,
      }
    : headerMobile
      ? {
          icon: <FiSmartphone className="shrink-0 text-gray-400" size={14} />,
          value: `${headerDial ? `+${String(headerDial).replace(/^\+/, "")}` : ""}${headerMobile}`,
          isPhone: true,
        }
      : {
          icon: <FiMail className="shrink-0 text-gray-400" size={14} />,
          value: "—",
          isPhone: false,
        };

  // Same gate as the sidebar tab and the CheckResetPassword HOC: a social
  // account has no password in our system to change, so the entry point is
  // hidden rather than leading to a dead end.
  const showResetPasswordAction =
    authType == "email" ||
    (authType == "phone" && setting?.phone_auth_password == 1);

  const authLabel =
    authType === "google"
      ? "Google"
      : authType === "phone"
        ? t("mobileNumber")
        : t("email");

  return (
    <div
      dir={dir}
      className="w-full mx-auto h-fit cardBorder bg-white dark:bg-zinc-900 rounded-2xl shadow-sm"
    >
      <form onSubmit={handleProfileUpdate} className="w-full flex flex-col">
        {/* Hero header — soft primary tint, avatar overlaps into the body below */}
        <div className="relative px-6 pt-6 pb-14 rounded-t-2xl bg-[color-mix(in_srgb,var(--primary-color,#29363f)_7%,transparent)]">
          <h2 className="text-lg font-bold textColor">{t("editProfile")}</h2>
          <p className="text-xs subTextColor mt-0.5">
            {t("update_your_personal_details") ||
              "Update your personal details"}
          </p>
        </div>

        {/* Avatar + identity — pulled up over the hero edge */}
        <div className="px-6 -mt-10 flex items-end gap-4">
          <div className="relative group shrink-0">
            <div className="relative w-24 h-24 rounded-full flex items-center justify-center overflow-hidden ring-4 ring-white dark:ring-zinc-900 bg-white dark:bg-zinc-800 shadow-md">
              <Image
                src={
                  profileImage
                    ? URL.createObjectURL(profileImage)
                    : user?.profile || setting?.web_settings?.placeholder_image
                }
                alt="profile image"
                fill
                className="h-full w-full object-cover"
                sizes="96px"
              />
            </div>
            <label
              htmlFor="profileImage"
              className="absolute bottom-0.5 end-0.5 primaryBackColor p-2 rounded-full cursor-pointer text-white shadow-md hover:scale-105 transition-transform duration-200"
              title={t("change_photo") || "Change photo"}
            >
              <FiCamera size={13} />
            </label>
            <input
              type="file"
              id="profileImage"
              className="hidden"
              accept="image/png, image/jpeg"
              onChange={onImageChange}
            />
          </div>
          <div className="flex flex-col pb-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-xl font-bold textColor truncate">
                {username || user?.name || "—"}
              </h3>
              {/* {authType && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold primaryColor bg-[color-mix(in_srgb,var(--primary-color,#29363f)_12%,transparent)]">
                  <FiCheck size={10} /> {authLabel}
                </span>
              )} */}
            </div>
            {/* Phone-signup accounts have no email, so the line fell back to a
                bare "—". Show whichever identifier the account actually has,
                with the icon following suit. */}
            <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5 truncate">
              {contactLine.icon}
              <span
                className="truncate"
                dir={contactLine.isPhone ? "ltr" : undefined}
              >
                {contactLine.value}
              </span>
            </p>
          </div>
        </div>
        {errors.image && (
          <p className="px-6 text-xs text-red-500 mt-2">{errors.image}</p>
        )}

        {/* Form body */}
        <div className="px-6 pt-6 pb-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-6">
            {/* Left: Personal Information */}
            <section className="flex flex-col gap-5">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-zinc-800">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg primaryColor bg-[color-mix(in_srgb,var(--primary-color,#29363f)_10%,transparent)]">
                  <FiUser size={15} />
                </span>
                <h4 className="font-bold text-sm textColor">
                  {t("personal_information") || "Personal Information"}
                </h4>
              </div>

              {/* Full Name */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="name"
                  className="text-xs font-semibold uppercase tracking-wider text-gray-500"
                >
                  {t("name")} <span className="text-red-500">*</span>
                </label>
                <div className="relative flex items-center w-full">
                  <span className="absolute start-3.5 text-gray-400">
                    <FiUser size={16} />
                  </span>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    placeholder={t("name")}
                    className={inputClass(errors.name, false)}
                    value={username || ""}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
                {errors.name && (
                  <p className="text-xs text-red-500">{errors.name}</p>
                )}
              </div>

              {/* Country */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {t("country") || "Country"}
                </label>
                <CountrySelect
                  value={countryId}
                  onChange={(country) => setCountryId(country?.id || "")}
                  onReady={(country) => {
                    if (!countryId) setCountryId(country?.id || "");
                  }}
                />
              </div>
            </section>

            {/* Right: Contact Information */}
            <section className="flex flex-col gap-5">
              <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-zinc-800">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg primaryColor bg-[color-mix(in_srgb,var(--primary-color,#29363f)_10%,transparent)]">
                  <FiMail size={15} />
                </span>
                <h4 className="font-bold text-sm textColor">
                  {t("contact_information") || "Contact Information"}
                </h4>
              </div>

              {/* Email Address */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="email"
                  className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1"
                >
                  {t("email")}{" "}
                  {authType !== "phone" && (
                    <span className="text-red-500">*</span>
                  )}
                  {emailLocked && (
                    <FiLock className="text-gray-400" size={12} />
                  )}
                </label>
                <div className="relative flex items-center w-full">
                  <span className="absolute start-3.5 text-gray-400">
                    <FiMail size={16} />
                  </span>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    placeholder={t("email")}
                    className={inputClass(errors.email, emailLocked)}
                    value={email || ""}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={emailLocked}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-red-500">{errors.email}</p>
                )}
              </div>

              {/* Mobile Number */}
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="mobile"
                  className="text-xs font-semibold uppercase tracking-wider text-gray-500 flex items-center gap-1"
                >
                  {t("mobileNumber")}{" "}
                  {authType === "phone" && (
                    <span className="text-red-500">*</span>
                  )}
                  {mobileLocked && (
                    <FiLock className="text-gray-400" size={12} />
                  )}
                </label>
                <PhoneNumberInput
                  value={mobileNumber || ""}
                  countryCode={countryCode}
                  onChange={handlePhoneChange}
                  disabled={mobileLocked}
                  hasError={!!errors.mobile}
                />
                {errors.mobile && (
                  <p className="text-xs text-red-500">{errors.mobile}</p>
                )}
              </div>
            </section>
          </div>

          {/* Actions — secondary account actions on the start edge, the primary
              save on the end. Delete is styled quietest of the three: it's the
              one irreversible action here, so it should take deliberate aim
              rather than sit as a big red target next to Save. */}
          <div className="mt-8 pt-5 border-t border-gray-100 dark:border-zinc-800 flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-3">
            <div className="flex items-center gap-1">
              {showResetPasswordAction && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(true)}
                    className="px-3 py-2 rounded-lg text-sm font-semibold SecondaryTextColor hover:textColor hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <FiLock size={14} />
                    {t("resetPassword")}
                  </button>
                  <span className="h-4 w-px bg-gray-200 dark:bg-zinc-700" />
                </>
              )}

              <button
                type="button"
                onClick={handleDelete}
                className="px-3 py-2 rounded-lg text-sm font-semibold SecondaryTextColor hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors flex items-center justify-center gap-1.5"
              >
                <FiTrash2 size={14} />
                {t("delete_account")}
              </button>
            </div>

            {/* Title explains the disabled state — an un-clickable button with no
                stated reason reads as broken rather than as "nothing to save". */}
            <button
              type="submit"
              title={
                isSaving
                  ? undefined
                  : !isFormValid
                    ? t("please_fix_errors_above") ||
                      "Fix the errors above first"
                    : isChanged === false
                      ? t("no_changes_to_save") || "No changes to save"
                      : undefined
              }
              className="px-6 py-2.5 primaryBackColor hover:opacity-90 text-white rounded-xl font-semibold text-sm shadow-sm transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none flex items-center justify-center gap-2"
              disabled={isChanged === false || !isFormValid || isSaving}
            >
              {isSaving && <FiLoader size={15} className="animate-spin" />}
              {isSaving
                ? t("saving") || "Saving…"
                : t("save_changes") || t("editProfile")}
            </button>
          </div>
        </div>
      </form>
      <DeleteModal showDelete={showDelete} setShowDelete={setShowDelete} />
      <ResetPasswordModal
        showResetPassword={showResetPassword}
        setShowResetPassword={setShowResetPassword}
      />
    </div>
  );
};

export default Profile;
