"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { FiChevronDown } from "react-icons/fi";
import * as api from "@/api/apiRoutes";
import { t } from "@/utils/translation";
import useIsRtl from "@/hooks/useIsRtl";
import {
  getMobileLengthBounds,
  validateMobileLength,
} from "@/utils/mobileValidation";

/**
 * Country dial-code picker + phone number field in one bordered group.
 * Replaces `react-international-phone`.
 *
 * Self-contained: fetches the country list from the API and owns the dropdown
 * UI. It reports changes up via `onChange` so the parent can drive its own
 * auth state (dial code + digits + full number).
 *
 * Props:
 *  - value: digits the user typed, WITHOUT the dial code (controlled).
 *  - onChange({ dialCode, rawPhone, fullNumber, country }): fired on country
 *    OR number change.
 *  - onCountryReady(country): fired once when the default country resolves,
 *    so the parent can seed its dial code before the user types.
 *  - autoFocus: focus the number field on mount.
 *
 * Length rules come from the selected country's `min_mobile_length` /
 * `max_mobile_length` (countries API), so they change with the dial code. The
 * max is enforced by refusing the extra keystrokes; the min can only be checked
 * once the user stops typing, so it surfaces as an inline message under the
 * field and is also reported up via onChange's `lengthError` for parents that
 * gate their submit on it.
 */
// Shared across all mounted instances so rendering two PhoneNumberInputs on
// one page (e.g. mobile + alternate mobile) issues a single request instead
// of one per instance.
let dialCountriesPromise = null;
const fetchDialCountries = () => {
  if (!dialCountriesPromise) {
    dialCountriesPromise = api.getDialCountries().catch((error) => {
      dialCountriesPromise = null;
      throw error;
    });
  }
  return dialCountriesPromise;
};

const PhoneNumberInput = ({
  value = "",
  onChange,
  onCountryReady,
  autoFocus = false,
  // When true, the country picker renders as its own full-width dropdown ABOVE
  // the number field (with a label), instead of inline inside the input.
  separateCountry = false,
  countryLabel,
  countryCode,
  disabled = false,
  hasError = false,
}) => {
  const [countries, setCountries] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const rtl = useIsRtl();
  const dir = rtl ? "rtl" : "ltr";

  // Load the dial-code list once. Default to the env country (matched on ISO
  // `code`), else the first country returned.
  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const res = await fetchDialCountries();
        if (res?.status == 1 && Array.isArray(res?.data) && res.data.length) {
          setCountries(res.data);
          const envCode = process.env.NEXT_PUBLIC_DEFAULT_COUNTRY_CODE;
          const match =
            res.data.find(
              (c) => c.code === envCode || c.dial_code === envCode,
            ) || res.data[0];
          setSelectedCountry(match);
          onCountryReady?.(match);
        }
      } catch (error) {
        console.log("Error fetching countries", error);
      }
    };
    fetchCountries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Synchronize selectedCountry with the countryCode prop if provided
  useEffect(() => {
    if (countries.length && countryCode) {
      const normalizedProp = countryCode.startsWith("+")
        ? countryCode
        : `+${countryCode}`;
      const match = countries.find(
        (c) => c.dial_code === normalizedProp || c.code === countryCode,
      );
      if (match) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs selectedCountry with the countryCode prop
        setSelectedCountry(match);
      }
    }
  }, [countryCode, countries]);

  // Close the dropdown on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // A dropdown with exactly one option isn't a choice — it's just noise (an
  // arrow the user can tap that does nothing useful). Hide the affordance and
  // block toggling entirely rather than rendering a picker over a list of one.
  const hasCountryChoice = countries.length > 1;

  const { max: maxLength } = getMobileLengthBounds(selectedCountry);

  // The inline message only appears once the user has actually typed — showing
  // "must be at least 7 digits" against an untouched field reads as an error the
  // user caused. `touched` is also reset when the country changes, since the new
  // country's rules haven't been violated yet either.
  const [touched, setTouched] = useState(false);
  const lengthError = validateMobileLength(value, selectedCountry);
  const showLengthError = touched && !!value && !!lengthError;

  const emit = (country, rawPhone) => {
    const dialCode = country?.dial_code || "";
    onChange?.({
      dialCode,
      rawPhone,
      fullNumber: rawPhone ? `${dialCode}${rawPhone}` : "",
      country,
      // Parents gate their submit on this rather than re-deriving the bounds.
      lengthError: validateMobileLength(rawPhone, country),
    });
  };

  const handleSelectCountry = (country) => {
    setSelectedCountry(country);
    setOpen(false);
    setTouched(false);
    // Switching country can invalidate digits that were fine a moment ago (a
    // 10-digit number under a max of 8), so re-emit to hand the parent a verdict
    // against the NEW country instead of leaving it holding the old one.
    emit(country, value);
  };

  const handleNumberChange = (e) => {
    // Hard stop at the country's max: extra keystrokes are dropped rather than
    // accepted-then-rejected, so the field can never hold an invalid-long value.
    const digits = e.target.value.replace(/\D/g, "").slice(0, maxLength);
    setTouched(true);
    emit(selectedCountry, digits);
  };

  // Shared dropdown list of countries (flag + name + dial code). `widthClass`
  // controls the menu width (full-width for the separate variant, fixed for
  // the inline one).
  const renderCountryMenu = (widthClass) =>
    open && (
      <ul
        role="listbox"
        className={`absolute ${rtl ? "right-0" : "left-0"} top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900 ${widthClass}`}
      >
        {countries.map((c) => {
          const active = selectedCountry?.id === c.id;
          return (
            <li key={c.id} role="option" aria-selected={active}>
              <button
                type="button"
                onClick={() => handleSelectCountry(c)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-start text-sm transition-colors hover:primaryLightBack ${
                  active ? "primaryLightBack primaryColor font-semibold" : ""
                }`}
              >
                {c.logo_url && (
                  <Image
                    src={c.logo_url}
                    alt={c.code}
                    width={22}
                    height={16}
                    className="h-4 w-[22px] shrink-0 rounded-[2px] object-cover"
                  />
                )}
                <span className="flex-1 truncate">{c.name}</span>
                <span dir="ltr" className="text-gray-500">
                  {c.dial_code}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    );

  const numberField = (rounded) => (
    <input
      type="tel"
      name="phone"
      dir="ltr"
      autoFocus={autoFocus}
      inputMode="numeric"
      maxLength={maxLength}
      value={value}
      onChange={handleNumberChange}
      onBlur={() => setTouched(true)}
      disabled={disabled}
      aria-invalid={showLengthError || undefined}
      placeholder={t("phone") || "Phone number"}
      className={`w-full bg-transparent px-4 py-2.5 outline-none ${rounded} ${
        rtl ? "text-right" : ""
      } ${disabled ? "cursor-not-allowed text-gray-400" : "textColor"}`}
    />
  );

  // Inline length message, rendered under whichever variant is in use. The
  // parent's own error styling (hasError) is independent of this — a form can
  // still mark the field red for its own reasons.
  const lengthMessage = showLengthError && (
    <p className="mt-1 text-xs text-red-500">{lengthError}</p>
  );

  // Variant A — separate full-width country dropdown ABOVE the number field.
  if (separateCountry) {
    return (
      <div dir={dir} className="flex flex-col gap-3">
        <div className="relative w-full" ref={ref}>
          {countryLabel && (
            <label className="mb-1 block text-base font-bold">
              {countryLabel}
            </label>
          )}
          <button
            type="button"
            disabled={disabled || !hasCountryChoice}
            onClick={() => hasCountryChoice && setOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={open}
            className={`mt-1.5 flex w-full items-center gap-2 rounded-lg border py-2.5 px-3 text-sm transition-colors bg-[#f4f5f7] dark:bg-zinc-800 border-gray-200 dark:border-zinc-700 ${
              disabled
                ? "bg-gray-100 dark:bg-zinc-700 cursor-not-allowed text-gray-400"
                : hasCountryChoice
                  ? "hover:bg-gray-200/50 dark:hover:bg-zinc-700/50"
                  : "cursor-default"
            }`}
          >
            {selectedCountry?.logo_url && (
              <Image
                src={selectedCountry.logo_url}
                alt={selectedCountry.code}
                width={22}
                height={16}
                className="h-4 w-[22px] shrink-0 rounded-[2px] object-cover"
              />
            )}
            <span className="flex-1 truncate text-start">
              {selectedCountry?.name}
            </span>
            <span dir="ltr" className="text-gray-500">
              {selectedCountry?.dial_code}
            </span>
            {hasCountryChoice && (
              <FiChevronDown
                size={16}
                className={`text-gray-500 transition-transform ${
                  open ? "rotate-180" : ""
                }`}
              />
            )}
          </button>
          {hasCountryChoice && renderCountryMenu("right-0")}
        </div>

        <div
          className={`flex items-stretch rounded-lg border transition-all duration-200 bg-[#f4f5f7] dark:bg-zinc-800 ${
            disabled ? "bg-gray-100 dark:bg-zinc-700 cursor-not-allowed" : ""
          } ${
            hasError
              ? "border-red-400 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-100"
              : "cardBorder focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100"
          }`}
        >
          <span
            dir="ltr"
            className={`flex items-center px-3 text-sm font-medium ${
              disabled ? "text-gray-400" : "text-gray-600 dark:text-zinc-300"
            }`}
          >
            {selectedCountry?.dial_code}
          </span>
          <span className="my-2.5 w-px bg-gray-200 dark:bg-zinc-700" />
          {numberField(rtl ? "rounded-l-lg" : "rounded-r-lg")}
        </div>
        {lengthMessage}
      </div>
    );
  }

  // Variant B (default) — country picker inline inside the input group. Wrapped
  // so the length message can sit under the bordered group rather than inside it.
  return (
    <div dir={dir}>
      <div
        className={`mt-1.5 flex items-stretch rounded-lg border transition-all duration-200 bg-[#f4f5f7] dark:bg-zinc-800 ${
          disabled ? "bg-gray-100 dark:bg-zinc-700 cursor-not-allowed" : ""
        } ${
          hasError
            ? "border-red-400 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-100"
            : "cardBorder focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100"
        }`}
      >
        <div className="relative shrink-0" ref={ref}>
          <button
            type="button"
            disabled={disabled || !hasCountryChoice}
            onClick={() => hasCountryChoice && setOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={open}
            className={`flex h-full items-center gap-1.5 ${rtl ? "rounded-r-lg" : "rounded-l-lg"} px-3 py-2.5 text-sm font-medium transition-colors ${
              disabled
                ? "cursor-not-allowed text-gray-400"
                : hasCountryChoice
                  ? "hover:bg-gray-200/50 dark:hover:bg-zinc-700/50"
                  : "cursor-default"
            }`}
          >
            {selectedCountry?.logo_url && (
              <Image
                src={selectedCountry.logo_url}
                alt={selectedCountry.code}
                width={20}
                height={14}
                className="h-3.5 w-5 rounded-[2px] object-cover"
              />
            )}
            <span dir="ltr" className="whitespace-nowrap">
              {selectedCountry?.dial_code}
            </span>
            {hasCountryChoice && (
              <FiChevronDown
                size={16}
                className={`text-gray-500 transition-transform ${
                  open ? "rotate-180" : ""
                }`}
              />
            )}
          </button>
          {/* Inline variant: fixed-width menu so it doesn't stretch full input. */}
          {hasCountryChoice && renderCountryMenu("w-56")}
        </div>

        <span className="my-2.5 w-px bg-gray-200 dark:bg-zinc-700" />
        {numberField(rtl ? "rounded-l-lg" : "rounded-r-lg")}
      </div>
      {lengthMessage}
    </div>
  );
};

export default PhoneNumberInput;
