import { t } from "@/utils/translation";

// Fallback bounds for when the countries API hasn't answered yet, or the country
// object it returned carries no length fields. Deliberately wide — the server is
// the authority on what a valid number looks like, so a client-side guess must
// never be the thing that rejects a legitimate number.
const FALLBACK_MIN = 4;
const FALLBACK_MAX = 15;

/**
 * Per-country mobile length bounds, from the `countries` API
 * (`min_mobile_length` / `max_mobile_length` on each country row).
 *
 * Tolerant of the country object being null (list still loading) or missing the
 * fields (older API build): falls back to a permissive range rather than
 * blocking input.
 */
export const getMobileLengthBounds = (country) => {
  const min = Number(country?.min_mobile_length);
  const max = Number(country?.max_mobile_length);
  return {
    min: Number.isFinite(min) && min > 0 ? min : FALLBACK_MIN,
    max: Number.isFinite(max) && max > 0 ? max : FALLBACK_MAX,
  };
};

// t() has no interpolation, so the {min}/{max} placeholders in en.json are
// substituted here.
const fill = (key, values) =>
  Object.entries(values).reduce(
    (str, [k, v]) => str?.replace(`{${k}}`, v),
    t(key),
  );

/**
 * Validate a digits-only mobile number against its country's bounds.
 *
 * Returns a ready-to-display message, or null when the number is acceptable.
 * An EMPTY value returns null — "required" is a separate concern each form
 * already handles, and surfacing a length error before the user has typed
 * anything reads as broken.
 */
export const validateMobileLength = (rawPhone, country) => {
  const digits = String(rawPhone ?? "").replace(/\D/g, "");
  if (!digits) return null;

  const { min, max } = getMobileLengthBounds(country);

  if (digits.length < min) {
    // A country whose min and max agree wants an exact count ("must be 10
    // digits"), which is clearer than a range with identical bounds.
    return min === max
      ? fill("mobile_exact_length_error", { min })
      : fill("mobile_range_length_error", { min, max });
  }
  if (digits.length > max) {
    return fill("mobile_max_length_error", { max });
  }
  return null;
};

/** True when the number is present AND within its country's bounds. */
export const isMobileLengthValid = (rawPhone, country) => {
  const digits = String(rawPhone ?? "").replace(/\D/g, "");
  if (!digits) return false;
  return !validateMobileLength(digits, country);
};
