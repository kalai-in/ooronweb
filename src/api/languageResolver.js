import axios from "axios";
import * as apiEndPoints from "@/api/apiEndpoints";

// Server-side language list, cached per process. Language codes drive the URL
// prefix (/ur/...), and admins can add a language at runtime — so the list can't
// be hardcoded or baked at build time. This fetches it once and caches it, the
// same shape as zoneResolver's getZonesCached.
//
// Middleware needs this to know which first segment is a language prefix. It
// runs the fetch lazily on the first request and reuses the cache after, so the
// "no API calls in middleware" guideline is honored in spirit — one cold fetch,
// not one per request.

const ACCESS_KEY = "903361";
const BASE = `${process.env.NEXT_PUBLIC_API_URL}${process.env.NEXT_PUBLIC_API_SUBURL}`;
const SYSTEM_TYPE_WEBSITE = 3;
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 min — languages change very rarely

let __cache = null; // { codes: Set, defaultCode: string }
let __cachedAt = 0;
let __inflight = null;

const fetchLanguages = async () => {
  const res = await axios.get(`${BASE}/${apiEndPoints.getSystemLanguage}`, {
    params: { system_type: SYSTEM_TYPE_WEBSITE },
    headers: { "x-access-key": ACCESS_KEY },
  });
  const rows = res.data?.data || [];
  const codes = new Set();
  let defaultCode = "en";
  for (const r of rows) {
    if (!r?.code) continue;
    codes.add(r.code);
    if (r.is_default == 1) defaultCode = r.code;
  }
  return { codes, defaultCode };
};

/**
 * { codes: Set<string>, defaultCode: string }, cached. Concurrent cold-cache
 * callers share one in-flight request. Falls back to a minimal English-only set
 * if the API is unreachable, so an outage degrades to "no language prefixes"
 * rather than 404-ing every page.
 */
export const getLanguagesCached = async ({ now = Date.now() } = {}) => {
  if (__cache && now - __cachedAt < CACHE_TTL_MS) return __cache;
  if (__inflight) return __inflight;

  __inflight = fetchLanguages()
    .then((data) => {
      __cache = data;
      __cachedAt = now;
      return data;
    })
    .catch((err) => {
      console.warn("[lang] fetch failed:", err?.message);
      return __cache || { codes: new Set(["en"]), defaultCode: "en" };
    })
    .finally(() => {
      __inflight = null;
    });

  return __inflight;
};
