export const extractJSONFromMarkup = (markupString: string): any => {
    // Equivalent to the `/s` (dotAll) flag via [\s\S], since the compile target
    // predates ES2018 dotAll support — behavior is identical to the original regex.
    const jsonRegex = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/;
    const match = markupString.match(jsonRegex);
    if (match && match.length >= 2) {
        const extractedJSON = match[1];

        try {
            return JSON.parse(extractedJSON);
        } catch (error) {
            console.error('Error parsing JSON:', error);
        }
    }

    return null;
};

// Normalize an API border_radius value (number, numeric string, or unit string)
// into a valid CSS length. Returns undefined when there is no radius.
//   16        -> "16px"
//   "16"      -> "16px"
//   "16px"    -> "16px"
//   "50%"     -> "50%"
//   "1rem"    -> "1rem"
export const toCssRadius = (
  value?: number | string | null,
): string | undefined => {
  if (value == null || value === "") return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? `${value}px` : undefined;
  const str = String(value).trim();
  if (str === "") return undefined;
  // Bare number (e.g. "16") -> add px. Anything with a unit/% is used as-is.
  return /^-?\d*\.?\d+$/.test(str) ? `${str}px` : str;
};

// Home-builder per-section `border_radius_corners` — replaces the old flat
// `border_radius` number with one value per corner (top_left, top_right,
// bottom_left, bottom_right), matching the CSS border-radius longhand order
// (top-left top-right bottom-right bottom-left). Any corner missing/invalid
// falls back to 0 rather than dropping the whole radius, since a partial
// object (e.g. only top corners set) is still a valid design intent.
// Returns undefined when every corner resolves to 0 — same "no radius, don't
// force overflow:hidden" behavior toCssRadius already gives callers.
export const toCssRadiusCorners = (
  corners?: {
    top_left?: number | string | null;
    top_right?: number | string | null;
    bottom_left?: number | string | null;
    bottom_right?: number | string | null;
  } | null,
): string | undefined => {
  if (!corners) return undefined;
  const px = (v?: number | string | null): string => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? `${n}px` : "0";
  };
  const topLeft = px(corners.top_left);
  const topRight = px(corners.top_right);
  const bottomRight = px(corners.bottom_right);
  const bottomLeft = px(corners.bottom_left);
  if (topLeft === "0" && topRight === "0" && bottomRight === "0" && bottomLeft === "0") {
    return undefined;
  }
  return `${topLeft} ${topRight} ${bottomRight} ${bottomLeft}`;
};

// Home-builder `image_aspect` ("3:1", "16:9", "1:1") -> a CSS aspect-ratio value.
//
// Replaces the old `image_height` pixel value: a fixed height crops differently
// at every viewport width, while a ratio keeps the banner's shape intact from
// mobile to desktop (and reserves the right space before the image loads, so it
// doesn't shift the page — the CLS input Core Web Vitals measures).
//
// Accepts "W:H" and "W/H"; returns undefined for anything unparseable so the
// caller can fall back.
//   "3:1"   -> "3 / 1"
//   "16/9"  -> "16 / 9"
//   ""      -> undefined
export const toCssAspectRatio = (
  value?: number | string | null,
): string | undefined => {
  if (value == null || value === "") return undefined;
  const parts = String(value).trim().split(/[:/]/);
  if (parts.length !== 2) return undefined;
  const w = Number(parts[0]);
  const h = Number(parts[1]);
  // A zero or negative side would collapse the box entirely.
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return undefined;
  }
  return `${w} / ${h}`;
};

// Pick the device-appropriate image URL from a home_layout `images` object
// ({ app, web, tablet }). Backend may leave a device variant empty, so fall back:
//   requested device → web → app → tablet → legacyUrl.
// `device` is "app" | "tablet" | "web" (from HomeLayout's viewport detection).
export const pickDeviceImage = (
  images?: Record<string, string> | null,
  device?: string,
  legacyUrl = "",
): string => {
  const imgs: Record<string, string> = images || {};
  return (
    imgs[device as string] || imgs.web || imgs.app || imgs.tablet || legacyUrl || ""
  );
};

// Pick the device-appropriate numeric value from a home_layout config field
// that may be either a per-breakpoint object ({ app, tablet, web }, as the
// backend now sends grid_columns/grid_gap/grid_rows/*_gap/*_radius) or a
// legacy flat number from before that shape existed. Same device →
// web → app → tablet fallback order as pickDeviceImage, then `fallback`.
export const pickDeviceNumber = (
  value: unknown,
  device?: string,
  fallback = 0,
): number => {
  if (value != null && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const picked = obj[device as string] ?? obj.web ?? obj.app ?? obj.tablet;
    const n = Number(picked);
    return Number.isFinite(n) ? n : fallback;
  }
  const n = Number(value);
  return Number.isFinite(n) && value !== "" && value != null ? n : fallback;
};

// Format a monetary amount using the currency symbol + decimal precision
// returned by the /cart (or settings) API response.
//   formatCurrency(536, "₹", 2)   -> "₹536.00"
//   formatCurrency(450, "₹", 2)   -> "₹450.00"
//   formatCurrency("46", "₹", 2)  -> "₹46.00"
// Invalid/missing amount -> 0; invalid/missing decimalPoint -> 0.
// `trimZeros`: drop a whole-number fraction (150.00 → 150) while keeping real
// fractions (109.99 → 109.99). Opt-in so existing callers are unaffected.
export const formatCurrency = (
  amount: number | string,
  currency = "",
  decimalPoint: number | string = 0,
  trimZeros = false,
): string => {
  const num = Number(amount);
  const safeNum = Number.isFinite(num) ? num : 0;
  const decimals = Number.isFinite(Number(decimalPoint))
    ? Number(decimalPoint)
    : 0;
  let text = safeNum.toFixed(decimals);
  // Strip a pure-zero fraction (and the now-dangling dot): 150.00 → 150.
  if (trimZeros && decimals > 0) {
    text = text.replace(/\.0+$/, "");
  }
  return `${currency ?? ""}${text}`;
};

// total_allowed_quantity caps how many units of a product a customer may add to
// the cart. A value of 0 (or missing/invalid) means NO cap — unlimited.
export const isUnlimitedAllowedQty = (limit?: number | string | null): boolean => {
  const num = Number(limit);
  return !Number.isFinite(num) || num <= 0;
};

// True when the current cart qty has hit the per-product cap and no more may be
// added. Always false when the product is unlimited (limit 0/missing).
//   hasReachedAllowedQty(3, 3) -> true   (capped at 3)
//   hasReachedAllowedQty(3, 0) -> false  (unlimited)
export const hasReachedAllowedQty = (
  currentQty?: number | string | null,
  limit?: number | string | null,
): boolean => {
  if (isUnlimitedAllowedQty(limit)) return false;
  return Number(currentQty || 0) >= Number(limit);
};

// Medical products (product_type 5) with is_prescription_required=1 must have a
// prescription File uploaded before the order can be placed. Returns the cart
// rows still missing one. `prescriptions` is the redux map (variantId -> File).
// Stale entries for removed variants are never inspected (self-healing), and it
// works for guest carts too (same row shape).
// Cart-row shape is API-driven and used loosely across the checkout flow.
export const getMissingRequiredPrescriptions = (
  items?: any[] | null,
  prescriptions?: Record<string, File> | null,
): any[] =>
  (items || []).filter((it) => {
    if (Number(it?.product_type) !== 5) return false;
    if (Number(it?.is_prescription_required) !== 1) return false;
    const vid = String(it?.variant_id ?? it?.product_variant_id);
    return !(prescriptions && prescriptions[vid] instanceof File);
  });

export const hasMissingRequiredPrescriptions = (
  items?: any[] | null,
  prescriptions?: Record<string, File> | null,
): boolean => getMissingRequiredPrescriptions(items, prescriptions).length > 0;

// True when adding would push the cart qty PAST the cap (strict >). Always false
// when unlimited. Use for "would this total exceed the limit" checks.
//   exceedsAllowedQty(4, 3) -> true
//   exceedsAllowedQty(4, 0) -> false  (unlimited)
export const exceedsAllowedQty = (
  totalQty?: number | string | null,
  limit?: number | string | null,
): boolean => {
  if (isUnlimitedAllowedQty(limit)) return false;
  return Number(totalQty || 0) > Number(limit);
};

// ── Variant stock helpers ───────────────────────────────────────────────────
// Stock fields can arrive as numbers OR strings (e.g. "0"/"1"), and thinner
// payloads (cart cross-sell / upsell recommendations) may OMIT them entirely.
// Strict number comparisons (`is_unlimited_stock === 0`, `stock > 0`) then
// misread a valid product as out-of-stock and block add-to-cart. These
// helpers coerce with Number() and treat MISSING fields as "not limited /
// available" — the backend re-validates stock on add anyway.

// Unlimited when is_unlimited_stock is anything other than 0/"0". Missing → treat
// as unlimited (don't block on absent data).
export const isVariantUnlimitedStock = (
  variant?: { is_unlimited_stock?: number | string | null } | null,
): boolean => {
  const v = variant?.is_unlimited_stock;
  if (v === undefined || v === null) return true;
  return Number(v) !== 0;
};

// Numeric stock; missing → Infinity (unknown ≠ zero, so don't block).
export const variantStock = (
  variant?: { stock?: number | string | null } | null,
): number => {
  const s = variant?.stock;
  if (s === undefined || s === null || s === "") return Infinity;
  return Number(s) || 0;
};

// True only when the variant is definitively out of stock: limited stock AND
// numeric stock <= 0. Missing fields → false (available).
export const isVariantOutOfStock = (
  variant?: { is_unlimited_stock?: number | string | null; stock?: number | string | null } | null,
): boolean => !isVariantUnlimitedStock(variant) && variantStock(variant) <= 0;

// True when the variant has stock available to add (unlimited, or limited with
// stock remaining). Missing fields → true.
export const isVariantInStock = (
  variant?: { is_unlimited_stock?: number | string | null; stock?: number | string | null } | null,
): boolean => !isVariantOutOfStock(variant);

// ── Global quantity cap (max_cart_items_count → total_allowed_quantity → stock) ──
// Single source of truth for "how many more of this line can the customer add".
// Sums qty across every row regardless of product/variant — this is a STORE-WIDE
// cap on total cart quantity, not a per-product one and not a distinct-line count.
export const getCartTotalQuantity = (items?: any[] | null): number =>
  (items || []).reduce((total, item) => total + (Number(item?.qty) || 0), 0);

// The effective max a customer may hold of ONE product line (an ABSOLUTE qty
// ceiling for that line, not "units left to add" — this is what a stepper's
// `max` should be set to), in priority order:
//   1) remaining_cart_capacity = max_cart_items_count - (cart total EXCLUDING this line)
//   2) product.total_allowed_quantity
//   3) available_stock (Infinity when unlimited/missing)
// A missing/non-finite/zero-or-less max_cart_items_count means "no store-wide cap".
//
// `otherLinesQty` must be the cart's total quantity MINUS this product/variant's
// own current qty (i.e. getCartTotalQuantity(cartItems) - thisLine.qty) — NOT the
// raw cart total — otherwise the line's own existing qty would be subtracted
// from its own headroom twice.
export const getMaxAddableQuantity = ({
  maxCartItemsCount,
  otherLinesQty,
  totalAllowedQty,
  isUnlimitedStock,
  stock,
}: {
  maxCartItemsCount?: number | string | null;
  otherLinesQty?: number | string | null;
  totalAllowedQty?: number | string | null;
  isUnlimitedStock?: boolean;
  stock?: number | string | null;
}): number => {
  const settingCap = isUnlimitedAllowedQty(maxCartItemsCount)
    ? Infinity
    : Math.max(0, Number(maxCartItemsCount) - (Number(otherLinesQty) || 0));
  const allowedCap = isUnlimitedAllowedQty(totalAllowedQty)
    ? Infinity
    : Number(totalAllowedQty);
  const stockCap = isUnlimitedStock ? Infinity : Number(stock) || 0;
  return Math.min(settingCap, allowedCap, stockCap);
};

// ── Date/time formatting driven by the country_setting API ──────────────────
// The API sends PHP-style format strings (e.g. date_format "d M Y", time_format
// "H:i"). We render them against a JS Date using the subset of PHP tokens the
// panel can emit. Format strings come from redux (CountrySetting), fetched
// app-wide in Layout — read via store.getState() so these stay plain functions.
import { store } from "@/redux/store";

const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MONTHS_SHORT = MONTHS_FULL.map((m) => m.slice(0, 3));
const DAYS_FULL = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];
const DAYS_SHORT = DAYS_FULL.map((d) => d.slice(0, 3));
const pad = (n: number): string => String(n).padStart(2, "0");

// Render a Date with a PHP-style format string. Unknown chars pass through;
// prefix a char with "\" to output it literally.
export const phpFormat = (d: Date, fmt: string): string => {
  const h24 = d.getHours();
  const h12 = h24 % 12 || 12;
  const tokens: Record<string, string | number> = {
    d: pad(d.getDate()),
    j: d.getDate(),
    D: DAYS_SHORT[d.getDay()],
    l: DAYS_FULL[d.getDay()],
    N: d.getDay() === 0 ? 7 : d.getDay(),
    w: d.getDay(),
    M: MONTHS_SHORT[d.getMonth()],
    F: MONTHS_FULL[d.getMonth()],
    m: pad(d.getMonth() + 1),
    n: d.getMonth() + 1,
    Y: d.getFullYear(),
    y: pad(d.getFullYear() % 100),
    H: pad(h24),
    G: h24,
    h: pad(h12),
    g: h12,
    i: pad(d.getMinutes()),
    s: pad(d.getSeconds()),
    A: h24 < 12 ? "AM" : "PM",
    a: h24 < 12 ? "am" : "pm",
  };
  let out = "";
  for (let i = 0; i < fmt.length; i++) {
    const c = fmt[i];
    if (c === "\\") {
      out += fmt[++i] ?? "";
    } else {
      out += c in tokens ? tokens[c] : c;
    }
  }
  return out;
};

const getCountryFormats = (): { date: string; time: string } => {
  const cs = (store.getState() as any).CountrySetting?.countrySetting;
  return {
    date: cs?.date_format || "d M Y",
    time: cs?.time_format || "H:i",
  };
};

export const sanitizeDate = (dateString: string): string => {
  if (!dateString) return "";
  if (typeof dateString !== "string") return dateString;
  let str = dateString.trim().replace(/Z+$/i, "");
  // Convert "YYYY-MM-DD HH:mm:ss" to "YYYY-MM-DDTHH:mm:ss"
  str = str.replace(
    /^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2}(?:\.\d+)?)/,
    "$1T$2"
  );
  // If ISO datetime without timezone offset, append 'Z' (UTC) so JS parses it as UTC
  // and converts to local browser time when formatting (getHours, getDate, etc.)
  if (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(str) &&
    !/[Zz]|[+-]\d{2}:?\d{2}$/.test(str)
  ) {
    str += "Z";
  }
  return str;
};

export const formatDate = (
  date?: string | number | Date | null,
  fmt?: string,
): string => {
  if (!date) return "";
  const sanitized = typeof date === "string" ? sanitizeDate(date) : date;
  const d = new Date(sanitized);
  if (isNaN(d as any)) return "";
  return phpFormat(d, fmt || getCountryFormats().date);
};

export const formatTime = (
  date?: string | number | Date | null,
  fmt?: string,
): string => {
  if (!date) return "";
  const sanitized = typeof date === "string" ? sanitizeDate(date) : date;
  const d = new Date(sanitized);
  if (isNaN(d as any)) return "";
  return phpFormat(d, fmt || getCountryFormats().time);
};

// Combined date + time, e.g. "05 Jul 2026 14:30".
export const formatDateTime = (date?: string | number | Date | null): string => {
  if (!date) return "";
  const { date: df, time: tf } = getCountryFormats();
  return formatDate(date, `${df} ${tf}`);
};

// Bounding-box midpoint of a zone's polygon_boundary vertices. The zones API
// returns no center point, so a zone can only be placed on the map when it
// has a boundary — many zones come back with an empty one, hence the null.
// A plain vertex average is wrong for a large/irregular/concave polygon (a
// zone drawn as a sparse outline around a wide area averages to some point
// nowhere near the zone's actual serviceable area) — the bounding-box
// midpoint stays anchored to the polygon's real extent regardless of vertex
// density or shape.
export const getPolygonCenter = (
  polygon?: { lat?: number | string; lng?: number | string }[] | null,
): { lat: number; lng: number } | null => {
  if (!Array.isArray(polygon) || polygon.length === 0) return null;
  const points = polygon.filter(
    (p) => Number.isFinite(Number(p?.lat)) && Number.isFinite(Number(p?.lng)),
  );
  if (points.length === 0) return null;
  const lats = points.map((p) => Number(p?.lat));
  const lngs = points.map((p) => Number(p?.lng));
  return {
    lat: (Math.min(...lats) + Math.max(...lats)) / 2,
    lng: (Math.min(...lngs) + Math.max(...lngs)) / 2,
  };
};
