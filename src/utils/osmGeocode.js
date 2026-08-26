// OpenStreetMap / Nominatim geocoding helpers.
// Replaces Google Maps Geocoder so the address map works on any domain
// without an API key. Nominatim usage policy: keep requests light and send a
// descriptive User-Agent/Referer (browser sends Referer automatically).

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

// Map a Nominatim `address` object into the flat shape the address form uses.
// `fallbackName` is the top-level `name`/first segment of `display_name`, used
// when the structured fields don't yield a street-level value (common for
// points dropped in open areas or unnamed roads).
const mapNominatimAddress = (addr = {}, fallbackName = "") => {
  const address =
    addr.road ||
    addr.pedestrian ||
    addr.residential ||
    addr.neighbourhood ||
    addr.quarter ||
    addr.suburb ||
    addr.hamlet ||
    addr.village ||
    fallbackName ||
    "";
  const landmark =
    addr.neighbourhood ||
    addr.residential ||
    addr.suburb ||
    addr.quarter ||
    addr.hamlet ||
    "";
  const area =
    addr.suburb ||
    addr.city_district ||
    addr.county ||
    addr.state_district ||
    addr.village ||
    "";
  const city =
    addr.city ||
    addr.town ||
    addr.municipality ||
    addr.village ||
    addr.county ||
    "";

  return {
    address,
    landmark,
    area,
    city,
    state: addr.state || "",
    country: addr.country || "",
    pincode: addr.postcode || "",
  };
};

// Reverse geocode: lat/lng -> address fields.
export const reverseGeocode = async (lat, lng) => {
  const url = `${NOMINATIM_BASE}/reverse?format=jsonv2&lat=${lat}&lon=${lng}&addressdetails=1`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Nominatim reverse failed: ${res.status}`);
  const data = await res.json();
  if (!data || !data.address) return null;
  const fallbackName =
    data.name || (data.display_name ? data.display_name.split(",")[0] : "");
  return {
    ...mapNominatimAddress(data.address, fallbackName),
    lat: parseFloat(data.lat),
    lng: parseFloat(data.lon),
  };
};

// Forward geocode: free-text address -> lat/lng.
export const forwardGeocode = async (query) => {
  const url = `${NOMINATIM_BASE}/search?format=jsonv2&q=${encodeURIComponent(
    query,
  )}&addressdetails=1&limit=1`;
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Nominatim search failed: ${res.status}`);
  const data = await res.json();
  if (!Array.isArray(data) || data.length === 0) return null;
  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
  };
};
