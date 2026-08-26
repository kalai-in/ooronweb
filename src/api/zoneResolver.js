import axios from "axios";
import * as apiEndPoints from "@/api/apiEndpoints";
import { getPolygonCenter } from "@/utils/helperFunction";

// Server-side zone slug -> coordinates. SSR can't read the client's
// localStorage city, so it resolves location from the URL's zone slug
// instead. Standalone (no shared axios/Redux) — see serverApi.js.

const ACCESS_KEY = "903361";
const BASE = `${process.env.NEXT_PUBLIC_API_URL}${process.env.NEXT_PUBLIC_API_SUBURL}`;
const authHeaders = { "x-access-key": ACCESS_KEY };

// Zones change rarely — cache per process. No per-user state, safe to share.
const CACHE_TTL_MS = 1000 * 60 * 10;
let __zonesCache = null;
let __zonesCachedAt = 0;
let __zonesInflight = null;

// /zones is COUNTRY-SCOPED (no country_id = default country's zones only), so a
// zone like /perth 404s otherwise. No "all countries" param exists, so we
// enumerate countries and merge their zone lists.
const fetchCountryIds = async () => {
  const res = await axios.get(`${BASE}/${apiEndPoints.getCountries}`, {
    params: { limit: 200, offset: 0 },
    headers: authHeaders,
  });
  return (res.data?.data || []).map((c) => c?.id).filter((id) => id != null);
};

const fetchZonesForCountry = async (countryId) => {
  const params = {};
  if (countryId != null) params.country_id = countryId;
  const response = await axios.get(`${BASE}/${apiEndPoints.getZones}`, {
    params,
    headers: authHeaders,
  });
  return response.data?.data || [];
};

const fetchZones = async ({ countryId } = {}) => {
  // Explicit country → that country only (sitemap uses this when scoped).
  if (countryId != null) return fetchZonesForCountry(countryId);

  // No country → merge every country's zones. Falls back to the default
  // list if the countries lookup fails.
  let countryIds = [];
  try {
    countryIds = await fetchCountryIds();
  } catch (err) {
    console.warn("[zones] countries fetch failed:", err?.message);
  }
  if (!countryIds.length) return fetchZonesForCountry();

  const perCountry = await Promise.all(
    countryIds.map((id) =>
      fetchZonesForCountry(id).catch((err) => {
        console.warn(`[zones] country ${id} failed:`, err?.message);
        return [];
      }),
    ),
  );
  // Dedupe by slug — a zone shouldn't repeat across countries, but be safe.
  const bySlug = new Map();
  for (const list of perCountry) {
    for (const z of list) {
      if (z?.slug && !bySlug.has(z.slug)) bySlug.set(z.slug, z);
    }
  }
  return [...bySlug.values()];
};

/**
 * Zone list, cached in-process. Concurrent callers during a cold cache share
 * one in-flight request instead of each firing their own.
 */
export const getZonesCached = async ({ countryId, now = Date.now() } = {}) => {
  if (__zonesCache && now - __zonesCachedAt < CACHE_TTL_MS) return __zonesCache;
  if (__zonesInflight) return __zonesInflight;

  __zonesInflight = fetchZones({ countryId })
    .then((zones) => {
      __zonesCache = zones;
      __zonesCachedAt = now;
      return zones;
    })
    .catch((err) => {
      // Must not crash gSSP with a 500 — degrade to stale cache or empty list,
      // so resolveZoneBySlug returns null and the caller 404s cleanly instead.
      console.warn("[zones] fetch failed:", err?.message);
      return __zonesCache || [];
    })
    .finally(() => {
      __zonesInflight = null;
    });

  return __zonesInflight;
};

/**
 * Zones can report channel "both", but product/home/listing endpoints reject
 * any value other than "quick"/"ecommerce". Maps "both" to "quick", matching
 * Header.jsx's own default for a "both" zone.
 */
export const requestChannel = (channel) =>
  channel === "quick" || channel === "ecommerce" ? channel : "quick";

/**
 * Resolves a zone slug to `{ zone, latitude, longitude, channel, rawChannel }`,
 * or null if the slug is unknown or its boundary can't produce a centroid.
 * `rawChannel` is the API's raw value (may be "both"); `channel` is narrowed
 * for header use.
 *
 * Channel must come from the zones API, not be derived: slug suffixes lie
 * ("surat-zone" is ecommerce), and getZone(lat/lng) picks the wrong zone
 * where polygons overlap (bhuj-ecommerce covers bhuj-quick's centroid).
 *
 * Only 6/21 zones currently have a polygon_boundary; the rest resolve to
 * null by design — callers should 404 rather than render with no location.
 */
export const resolveZoneBySlug = async (slug, { countryId } = {}) => {
  if (!slug) return null;

  const zones = await getZonesCached({ countryId });
  const zone = zones.find((z) => z?.slug === slug);
  if (!zone) return null;

  const center = getPolygonCenter(zone.polygon_boundary);
  if (!center) return null;

  return {
    zone: { id: zone.id, name: zone.name, slug: zone.slug },
    latitude: center.lat,
    longitude: center.lng,
    channel: requestChannel(zone.channel),
    rawChannel: zone.channel ?? null,
  };
};

/**
 * SSR location of last resort for zone-less pages (bare "/" and "/products"):
 * the first zone with a usable centroid, as `{ latitude, longitude, channel }`,
 * or null if none does.
 *
 * settings.default_city alone isn't enough — it's optional in admin and
 * absent on some stores, which left the products API with no coordinates and
 * skipped the SSR fetch entirely (empty <main> for crawlers). A zone centroid
 * is a safe stand-in since the visitor's own city re-keys the query on
 * hydration; this only shapes the pre-hydration HTML.
 *
 * Zone-scoped URLs (/{zone}/products) use resolveZoneBySlug instead and
 * never reach here.
 */
export const firstZoneLocation = async ({ countryId } = {}) => {
  const zones = await getZonesCached({ countryId });
  for (const zone of zones) {
    const center = getPolygonCenter(zone?.polygon_boundary);
    if (center) {
      return {
        latitude: center.lat,
        longitude: center.lng,
        channel: requestChannel(zone?.channel),
        // Raw API value (may be "both"); channel above is header-narrowed.
        rawChannel: zone?.channel ?? null,
        slug: zone?.slug ?? null,
      };
    }
  }
  return null;
};

// Test/debug escape hatch — lets a caller force the next resolve to refetch.
export const __clearZonesCache = () => {
  __zonesCache = null;
  __zonesCachedAt = 0;
};
