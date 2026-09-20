// Edge-runtime language list for middleware.
//
// Middleware runs on the edge, where axios and Node APIs are unavailable — so
// this uses the global fetch and imports nothing from @/api. It mirrors
// languageResolver.js (which serves the same data to Node-side callers) but is
// deliberately dependency-free.
//
// Admins can add a language at runtime, so the prefix list can't be hardcoded.
// The list is fetched once per edge instance and cached in module scope. A cold
// instance pays one fetch; every request after reuses it.

const ACCESS_KEY = "903361";
const SYSTEM_TYPE_WEBSITE = 3;
const CACHE_TTL_MS = 1000 * 60 * 30;

type EdgeLanguages = { codes: Set<string>; defaultCode: string };

let __cache: EdgeLanguages | null = null;
let __cachedAt = 0;
let __inflight: Promise<EdgeLanguages> | null = null;

const fetchLanguages = async (): Promise<EdgeLanguages> => {
  const base = `${process.env.NEXT_PUBLIC_API_URL}${process.env.NEXT_PUBLIC_API_SUBURL}`;
  const url = `${base}/system_languages?system_type=${SYSTEM_TYPE_WEBSITE}`;
  const res = await fetch(url, { headers: { "x-access-key": ACCESS_KEY } });
  const json = await res.json();
  const rows = json?.data || [];
  const codes = new Set<string>();
  let defaultCode = "en";
  for (const r of rows) {
    if (!r?.code) continue;
    codes.add(r.code);
    if (r.is_default == 1) defaultCode = r.code;
  }
  return { codes, defaultCode };
};

/**
 * { codes, defaultCode }, cached. On fetch failure falls back to English-only,
 * so an API outage degrades to "no language prefixes" rather than 404-ing every
 * localized URL.
 */
export const getEdgeLanguages = async (now = Date.now()): Promise<EdgeLanguages> => {
  if (__cache && now - __cachedAt < CACHE_TTL_MS) return __cache;
  if (__inflight) return __inflight;

  __inflight = fetchLanguages()
    .then((data) => {
      __cache = data;
      __cachedAt = now;
      return data;
    })
    .catch(() => __cache || { codes: new Set(["en"]), defaultCode: "en" })
    .finally(() => {
      __inflight = null;
    });

  return __inflight;
};
