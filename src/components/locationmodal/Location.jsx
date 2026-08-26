import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogOverlay,
} from "@/components/ui/dialog";
import { debounce } from "lodash";
import { t } from "@/utils/translation";
import { useSelector, useDispatch } from "react-redux";
import Image from "next/image";
import { FaLocationCrosshairs } from "react-icons/fa6";
import * as api from "@/api/apiRoutes";
import { setCity } from "@/redux/slices/citySlice";
import { toast } from "react-toastify";
import Loader from "../loader/Loader";
import { RiCloseFill } from "react-icons/ri";
import { FiSearch, FiChevronDown } from "react-icons/fi";
import { MdLocationPin } from "react-icons/md";
import MapWrapper from "@/components/maps/MapWrapper";
import useGeocode from "@/hooks/useGeocode";
import { getPolygonCenter } from "@/utils/helperFunction";
import useLanguages from "@/hooks/useLanguages";
import location from "@/assets/location.svg";
import ThemedSvg from "@/components/notfound/ThemedSvg";
import { useRouter } from "next/router";
import {
  setSelectedZone as setSelectedZoneAction,
  setSelectedCountry,
} from "@/redux/slices/locationModalSlice";
import { buildZoneUrl } from "@/utils/zoneUrl";
import useDefaultCountry from "@/hooks/useDefaultCountry";

const stripEmoji = (name = "") =>
  name
    .replace(/[\p{Extended_Pictographic}\p{Emoji_Presentation}️‍]/gu, "")
    .trim();

const renderZonesContent = (
  zonesLoading,
  countryZones,
  selectedZone,
  checkingZone,
  handleSelectZone,
) => {
  if (zonesLoading) {
    return (
      <div className="flex flex-wrap gap-2.5">
        {Array.from({ length: 8 }).map((_, i) => (
          <span
            key={i}
            className="h-11 w-32 animate-pulse rounded-lg buttonBackground"
          />
        ))}
      </div>
    );
  }
  if (countryZones.length > 0) {
    return (
      <div className="flex flex-wrap gap-2.5">
        {countryZones.map((zone) => (
          <button
            key={zone.id}
            type="button"
            disabled={checkingZone}
            onClick={() => handleSelectZone(zone)}
            className={`rounded-lg border px-2 py-2.5 text-sm transition-all duration-200 disabled:opacity-60 ${
              selectedZone?.id === zone.id
                ? "primaryBorderColor primaryColor primaryLightBack font-semibold shadow-sm"
                : "border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 textColor font-medium shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-[var(--primary-color)] hover:shadow-sm"
            }`}
          >
            {stripEmoji(zone.name)}
          </button>
        ))}
      </div>
    );
  }
  return (
    <p className="rounded-xl buttonBackground px-3 py-2.5 text-xs SecondaryTextColor">
      {t("no_zones_for_country") ||
        "No delivery zones listed for this country yet. Search or pick a point on the map instead."}
    </p>
  );
};

const Location = ({ showLocation, setShowLocation }) => {
  // Resolves the backend's is_default country when none is stored, which in
  // turn drives the zone fetch below.
  useDefaultCountry();
  const router = useRouter();
  const { parseLangPath } = useLanguages();
  const city = useSelector((state) => state.City);
  const setting = useSelector((state) => state.Setting);
  const theme = useSelector((state) => state.Theme.theme);
  const inputDomRef = useRef(null);
  const debounceTimeoutRef = useRef(null);
  const dispatch = useDispatch();
  const [mapView, setMapView] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [center, setCenter] = useState();
  const [inputValue, setInputValue] = useState("");
  const [resultedPlaces, setResultedPlaces] = useState([]);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [mapSearchValue, setMapSearchValue] = useState("");
  const [mapResults, setMapResults] = useState([]);
  const [mapHighlightedIndex, setMapHighlightedIndex] = useState(-1);
  const mapSearchDebounceRef = useRef(null);
  const [checkingZone, setCheckingZone] = useState(false);

  // Country can be switched from HERE as well as the footer — the modal is the
  // first thing a visitor sees, and the footer selector is a scroll away, so a
  // multi-country shop had no way to change country before picking a zone.
  // Both write the same `LocationModal.selectedCountry`, so the two stay in sync.
  const selectedCountry = useSelector(
    (state) => state?.LocationModal?.selectedCountry,
  );
  const [countryOpen, setCountryOpen] = useState(false);
  const countryRef = useRef(null);
  const countryOptionRefs = useRef([]);
  const [countryZones, setCountryZones] = useState([]);
  const [zonesLoading, setZonesLoading] = useState(false);
  // Zone whose boundary is shaded on the map, set by picking a zone chip.
  const [selectedZone, setSelectedZone] = useState(null);

  const { reverseGeocode } = useGeocode();

  const [localLocation, setlocalLocation] = useState({
    city: "",
    formatted_address: "",
    lat: Number.parseFloat(0),
    lng: Number.parseFloat(0),
  });

  // Same query key as Footer.jsx's countries fetch, so whichever mounts second reads cache.
  const { data: countries = [] } = useQuery({
    queryKey: ["countries", city?.city?.latitude, city?.city?.longitude],
    queryFn: () =>
      api
        .getCountries({
          limit: 100,
          offset: 0,
          latitude: city?.city?.latitude,
          longitude: city?.city?.longitude,
        })
        .then((res) => res?.data || []),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });

  // Close the country popover on outside click / Escape (mirrors the footer's).
  useEffect(() => {
    if (!countryOpen) return;
    const handlePointerDown = (e) => {
      if (countryRef.current && !countryRef.current.contains(e.target)) {
        setCountryOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setCountryOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    countryOptionRefs.current[0]?.focus();
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [countryOpen]);

  // Arrow-key roving focus + Enter/Space to pick, matching native listbox behavior.
  const handleCountryListKeyDown = (e) => {
    const options = countryOptionRefs.current.filter(Boolean);
    const currentIndex = options.indexOf(document.activeElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      options[(currentIndex + 1) % options.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      options[(currentIndex - 1 + options.length) % options.length]?.focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const country = countries[currentIndex];
      if (country) handleCountryChange(country);
    }
  };

  // Switching country invalidates the picked zone: zone ids are per-country, so
  // a leftover selection would keep shading a boundary that is no longer listed.
  const handleCountryChange = (country) => {
    setCountryOpen(false);
    if (String(country?.id) === String(selectedCountry?.id)) return;
    setSelectedZone(null);
    dispatch(setSelectedCountry(country));
  };

  // Zones for the picked country. `center` is derived from polygon_boundary —
  // the API sends no center point, and many zones come back with an empty
  // boundary, so those get a null center and open the map instead of jumping.
  useEffect(() => {
    if (!selectedCountry?.id) {
      setCountryZones([]);
      return;
    }
    let active = true;
    setZonesLoading(true);
    api
      .getZones({ country_id: selectedCountry.id })
      .then((res) => {
        if (!active) return;
        const zones = (res?.data || []).map((zone) => ({
          id: zone.id,
          name: zone.name,
          // Backend-provided slug, used verbatim in zone URLs. Never derive one
          // from the name — "Bhuj (Quick)" is slugged "bhuj-quick".
          slug: zone.slug,
          boundary: Array.isArray(zone.polygon_boundary)
            ? zone.polygon_boundary
            : [],
          center: getPolygonCenter(zone.polygon_boundary),
        }));
        setCountryZones(zones);
      })
      .catch((err) => {
        console.error("Zones fetch failed:", err?.message);
        if (active) setCountryZones([]);
      })
      .finally(() => {
        if (active) setZonesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedCountry?.id]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setlocalLocation({ lat: lat, lng: lng });
      },
      () => {
        // Permission denied / unavailable: fall back to the selected city so the
        // map never opens on 0,0 (ocean) with no feedback.
        const cityLat = Number.parseFloat(city?.latitude);
        const cityLng = Number.parseFloat(city?.longitude);
        if (cityLat && cityLng) {
          setlocalLocation({ lat: cityLat, lng: cityLng });
        }
      },
    );
    // Only meant to re-request geolocation when the modal opens; city is read live
    // inside the (async) permission-denied callback, so adding it here would re-trigger
    // the browser's geolocation prompt on every city change instead of only on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showLocation]);

  useEffect(() => {
    const center = {
      lat: localLocation.lat,
      lng: localLocation.lng,
      streetViewControl: false,
    };
    setCenter(center);
  }, [localLocation.lat, localLocation.lng]);

  useEffect(() => {
    const inputEl = inputDomRef.current;
    if (inputEl) {
      // handleKeyDown is declared further below (it calls handleSelectLocation/getPlacecDetails,
      // which in turn depend on handleConfirmLocation) — only referenced here inside the effect
      // callback and the event listener, both of which run after render, so the forward
      // reference is safe despite the lint rule's conservative "before declared" check.
      // Hoisting handleKeyDown's whole call chain above this effect would mean relocating
      // hundreds of lines of unrelated logic, so it's suppressed here instead.
      // eslint-disable-next-line react-hooks/immutability
      inputEl.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      if (inputEl) {
        inputEl.removeEventListener("keydown", handleKeyDown);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resultedPlaces, highlightedIndex]);

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      if (mapSearchDebounceRef.current) {
        clearTimeout(mapSearchDebounceRef.current);
      }
    };
  }, []);

  // Quick-pick a zone: open the map centred on it so the user can drop the
  // exact pin themselves. Zones with an empty boundary have no centre to jump
  // to, so the map just opens wherever it already was.
  const handleSelectZone = async (zone) => {
    setErrorMessage("");
    setSelectedZone(zone);
    // Remember the whole zone object (slug included) as the API returned it.
    // The URL swap happens on confirm, not here — this only opens the map.
    dispatch(setSelectedZoneAction(zone));
    setMapView(true);
    if (!zone.center) return;
    setCheckingZone(true);
    try {
      const geo = await reverseGeocode(zone.center.lat, zone.center.lng);
      setlocalLocation({
        city: zone.name,
        formatted_address: geo?.formatted_address || zone.name,
        lat: zone.center.lat,
        lng: zone.center.lng,
      });
    } catch (error) {
      console.log("Error resolving zone centre:", error);
      setlocalLocation({
        city: zone.name,
        formatted_address: zone.name,
        lat: zone.center.lat,
        lng: zone.center.lng,
      });
    } finally {
      setCheckingZone(false);
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(() => {
      if (value.length > 2) {
        handleFetchPlaces(value);
      } else {
        setResultedPlaces([]);
      }
    }, 1000);
  };

  const handleCloseLocation = () => {
    setShowLocation(false);
    setMapView(false);
    setSelectedZone(null);
  };

  const handleViewMap = async () => {
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        // Success callback
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setlocalLocation({ lat: lat, lng: lng });

        try {
          const result = await reverseGeocode(lat, lng);
          if (result?.formatted_address) {
            setlocalLocation((state) => ({
              ...state,
              formatted_address: result.formatted_address,
            }));
          }
          setMapView(true);
        } catch (error) {
          toast.error(t("provided_api_invalid"));
          console.log("err", error);
        }
      },
      (error) => {
        // Error callback
        console.log("Geolocation error:", error);

        switch (error.code) {
          case error.PERMISSION_DENIED:
            toast.error(
              t("location_permission_denied") ||
                "Please enable location permission in your browser",
            );
            break;
          case error.POSITION_UNAVAILABLE:
            toast.error(
              t("location_unavailable") ||
                "Location information is unavailable",
            );
            break;
          case error.TIMEOUT:
            toast.error(t("location_timeout") || "Location request timed out");
            break;
          default:
            toast.error(
              t("location_error") ||
                "An unknown error occurred while getting location",
            );
            break;
        }
      },
      {
        // Options
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      },
    );
  };

  const handleConfirmLocation = async (
    latitude,
    longitude,
    cityName,
    formattedAddress,
  ) => {
    try {
      if (errorMessage !== "") {
        setInputValue("");
        toast.error("We are not deliver on this city");
        return;
      }
      const resolvedLat = latitude ?? localLocation.lat;
      const resolvedLng = longitude ?? localLocation.lng;
      const result = await api.getZone({
        latitude: resolvedLat,
        longitude: resolvedLng,
        skipChannel: true,
      });
      if (result?.status == 1) {
        dispatch(
          setCity({
            data: {
              id: result.data.id,
              name: cityName || localLocation.city,
              state: result.data.state,
              formatted_address:
                formattedAddress || localLocation.formatted_address,
              latitude: resolvedLat,
              longitude: resolvedLng,
              min_amount_for_free_delivery:
                result.data.min_amount_for_free_delivery,
              delivery_charge_method: result.data.delivery_charge_method,
              fixed_charge: result.data.fixed_charge,
              per_km_charge: result.data.per_km_charge,
              time_to_travel: result.data.time_to_travel,
              max_deliverable_distance: result.data.max_deliverable_distance,
              distance: result.data.distance,
              zone_id: result.data.zone_id,
              channel: result.data.channel,
            },
          }),
        );
        // fetchShop(resolvedLat, resolvedLng);
        setShowLocation(false);
        setInputValue("");
        setResultedPlaces([]);
        setAddressLoading(false);
        setErrorMessage("");
        setMapView(false);

        // Swap the zone segment in place, keeping the rest of the path:
        //   /bhuj-quick/product/kiwi -> /surat-zone/product/kiwi
        //
        // Reads window.location, NOT router.asPath: middleware rewrites the
        // zone URL to /product/{slug}?zone=..., so asPath reports the internal
        // path and has no zone segment to swap. window.location is the URL the
        // user actually sees.
        //
        // A language prefix (e.g. /pt/bhuj-quick/...) must be stripped before
        // parsing the zone — parseZonePath has no language awareness, so on a
        // localized URL it misreads the lang code itself as the zone segment
        // (buildZoneUrl then no-ops instead of switching). Re-prefixed after.
        //
        // buildZoneUrl returns null for routes that aren't zone-prefixable yet
        // (only /product/{slug} is), so we stay put instead of navigating to a
        // 404. Widening ZONE_PREFIXABLE in zoneUrl.js is all that's needed once
        // more routes are migrated.
        const zoneSlug = selectedZone?.slug;
        if (zoneSlug && typeof window !== "undefined") {
          const currentPath = window.location.pathname;
          const { lang, rest } = parseLangPath(currentPath);
          const langlessPath = `/${rest.join("/")}`;
          const nextUrl = buildZoneUrl(langlessPath, zoneSlug);
          if (nextUrl && nextUrl !== langlessPath) {
            const localizedNextUrl = lang ? `/${lang}${nextUrl}` : nextUrl;
            // `zone`, `slug`, and `lang` are middleware/route internals —
            // echoing them back would resurrect the params the routing
            // replaced (lang is already carried by the pathname above).
            const publicQuery = Object.fromEntries(
              Object.entries(router.query).filter(
                ([key]) => key !== "zone" && key !== "slug" && key !== "lang",
              ),
            );
            router.push({ pathname: localizedNextUrl, query: publicQuery });
          }
        }
      } else if (result.status == 0) {
        setLoading(false);
        toast.error(t("We_doesn't_deliver_at_selected_city"));
        setShowLocation(true);
      } else {
        setLoading(false);
        setErrorMessage(result.message);
      }
    } catch (error) {
      console.log("error", error);
    }
  };

  // Provider-agnostic: reverse-geocode a dropped/clicked point, validate the
  // delivery zone, then update the marker + address line. Used by both the
  // map click and marker drag handlers under either map provider.
  const resolvePoint = async (lat, lng) => {
    setAddressLoading(true);
    try {
      const geo = await reverseGeocode(lat, lng);
      const formatted = geo?.formatted_address || "";
      const res = await api.getZone({
        latitude: lat,
        longitude: lng,
        skipChannel: true,
      });
      if (res?.status === 1) {
        setlocalLocation({
          formatted_address: formatted,
          city: res?.data?.name,
          lat,
          lng,
        });
        setErrorMessage("");
      } else {
        setlocalLocation({
          city: null,
          formatted_address: formatted,
          lat,
          lng,
        });
        setErrorMessage(res?.message || "");
      }
    } catch (error) {
      console.log("err", error);
    } finally {
      setAddressLoading(false);
    }
  };

  const debouncedResolvePoint = useRef(
    debounce((lat, lng) => resolvePoint(lat, lng), 500),
  ).current;

  const handleMapClick = ({ lat, lng }) => {
    debouncedResolvePoint(lat, lng);
  };

  const handleDragEnd = ({ lat, lng }) => {
    resolvePoint(lat, lng);
  };

  const handleMapKeyDown = (e) => {
    if (!mapResults?.suggestions?.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMapHighlightedIndex((prev) =>
        prev < mapResults.suggestions?.length - 1 ? prev + 1 : 0,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMapHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : mapResults?.suggestions?.length - 1,
      );
    } else if (e.key === "Enter") {
      if (mapHighlightedIndex >= 0) {
        const selected = mapResults?.suggestions[mapHighlightedIndex];
        handleMapSelectLocation(selected?.placePrediction);
      }
    }
  };

  const handleFetchPlaces = async (input) => {
    setHighlightedIndex(-1);
    try {
      const response = await api.getPlaces({ input: input });
      if (response.status === 1) {
        setResultedPlaces(response.data);
      } else {
        toast.error(response.message);
      }
    } catch (error) {
      console.error("Error fetching places:", error);
      toast.error("Failed to fetch places");
    }
  };

  const handleKeyDown = (e) => {
    if (!resultedPlaces?.suggestions?.length) return;
    if (e.key === "ArrowDown") {
      setHighlightedIndex((prev) =>
        prev < resultedPlaces.suggestions?.length - 1 ? prev + 1 : 0,
      );
    } else if (e.key === "ArrowUp") {
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : resultedPlaces?.suggestions?.length - 1,
      );
    } else if (e.key === "Enter") {
      if (highlightedIndex >= 0) {
        const selected = resultedPlaces?.suggestions[highlightedIndex];
        handleSelectLocation(selected?.placePrediction);
      }
    }
  };

  const handleSelectLocation = (place) => {
    const description = `${place.structuredFormat.mainText.text}, ${place.structuredFormat.secondaryText.text}`;
    setInputValue(description);
    // setSelectedLocation(place);
    setResultedPlaces([]);
    getPlacecDetails(place);
    setHighlightedIndex(-1);
  };

  const getPlacecDetails = async (place) => {
    try {
      const response = await api.getPlacesDetails({
        placeId: place.placeId,
      });

      if (response.status === 1) {
        const { latitude, longitude } = response?.data?.location ?? {};
        const cityName = response.data.addressComponents?.[0]?.longText;
        const formattedAddress = response.data.formattedAddress;
        setlocalLocation({
          formatted_address: response.data.formattedAddress,
          city: cityName,
          lat: Number.parseFloat(latitude),
          lng: Number.parseFloat(longitude),
        });
        await handleConfirmLocation(
          latitude,
          longitude,
          cityName,
          formattedAddress,
        );
        setAddressLoading(false);
      } else {
        // toast.error(response.message);
        setInputValue("");
        setErrorMessage(response.message);
      }
    } catch (error) {
      console.log("Error fetching place details:", error);
    }
  };

  // --- Map-view search: recenter the marker on a searched place WITHOUT
  // confirming/closing the modal (the user still drags/confirms manually). ---
  const handleMapSearchInput = (e) => {
    const value = e.target.value;
    setMapSearchValue(value);
    if (mapSearchDebounceRef.current) {
      clearTimeout(mapSearchDebounceRef.current);
    }
    mapSearchDebounceRef.current = setTimeout(() => {
      if (value.length > 2) {
        handleFetchMapPlaces(value);
      } else {
        setMapResults([]);
      }
    }, 800);
  };

  const handleFetchMapPlaces = async (input) => {
    setMapHighlightedIndex(-1);
    try {
      const response = await api.getPlaces({ input });
      if (response.status === 1) {
        setMapResults(response.data);
      } else {
        toast.error(response.message);
      }
    } catch (error) {
      console.error("Error fetching places:", error);
      toast.error("Failed to fetch places");
    }
  };

  const handleMapSelectLocation = async (place) => {
    const description = `${place.structuredFormat.mainText.text}, ${place.structuredFormat.secondaryText.text}`;
    setMapSearchValue(description);
    setMapResults([]);
    setMapHighlightedIndex(-1);
    setAddressLoading(true);
    try {
      const response = await api.getPlacesDetails({ placeId: place.placeId });
      if (response.status === 1) {
        const { latitude, longitude } = response?.data?.location ?? {};
        // Updating localLocation recenters the map + marker; validate deliverability for the new point.
        const res = await api.getZone({
          latitude,
          longitude,
          skipChannel: true,
        });
        setlocalLocation({
          formatted_address: response.data.formattedAddress,
          city: res?.status === 1 ? res?.data?.name : null,
          lat: Number.parseFloat(latitude),
          lng: Number.parseFloat(longitude),
        });
        setErrorMessage(res?.status === 1 ? "" : res?.message || "");
      } else {
        setErrorMessage(response.message);
      }
    } catch (error) {
      console.log("Error fetching place details:", error);
    } finally {
      setAddressLoading(false);
    }
  };

  const handleShowModal = () => {
    setShowLocation(false);
    setMapView(false);
  };

  const hasNoCityConfigured =
    setting.setting?.default_city == null && city?.city == null;
  let overlayClassName;
  if (theme == "light") {
    overlayClassName = hasNoCityConfigured ? "bg-white/100" : "bg-white/10";
  } else {
    overlayClassName = hasNoCityConfigured ? "bg-black/100" : "bg-black/10";
  }

  return (
    <>
      {loading ? (
        <Loader screen={"full"} />
      ) : (
        <Dialog open={showLocation} onOpenChange={handleCloseLocation}>
          <DialogOverlay className={overlayClassName} />
          {/* Wide enough that the zone chips wrap into a few rows instead of a
              scrolling column. max-h/overflow is a safety net for short
              viewports only — at normal heights nothing scrolls. The scrollbar
              stays visible when it does: hiding it (no-scrollbar) made the map
              view look clipped-and-stuck rather than scrollable. */}
          <DialogContent
            onInteractOutside={(e) => e.preventDefault()}
            className="max-w-2xl max-h-[92vh] overflow-y-auto"
            // The visible heading below lives in a DialogHeader (a plain div),
            // so Radix has no Title to name the dialog with. Same text, hidden.
            title={t("select_location")}
          >
            <DialogHeader className="text-lg font-extrabold flex-row items-center flex justify-between">
              <div className="flex items-center gap-2">
                <span className="primaryLightBack flex h-8 w-8 items-center justify-center rounded-full primaryColor">
                  <FaLocationCrosshairs size={16} className="primaryColor" />
                </span>
                {t("select_location")}
              </div>
              {setting.setting?.default_city == null && city?.city == null ? (
                <></>
              ) : (
                <div className="closeButtonBg rounded-full p-[8px] gap-[4px] cursor-pointer transition-transform duration-200 hover:scale-110 active:scale-95">
                  <RiCloseFill size={22} onClick={() => handleShowModal()} />
                </div>
              )}
            </DialogHeader>
            <div className="flex">
              {!mapView ? (
                <div className="flex flex-col w-full">
                  {setting?.setting?.web_settings?.web_logo && (
                    <div className="relative mx-auto h-[72px] w-[180px] mb-2">
                      <Image
                        src={setting?.setting?.web_settings?.web_logo}
                        fill
                        className="object-contain"
                        alt="logo"
                      />
                    </div>
                  )}
                  <h2 className="text-center font-bold text-base textColor">
                    {t("select_delivery_location")}
                  </h2>
                  <p className="text-center text-xs SecondaryTextColor mt-1 mb-5">
                    {t("search_delivery_location")}
                  </p>

                  <button
                    type="button"
                    className="group w-full rounded-xl primaryBackColor text-white py-3 px-4 text-sm font-semibold flex items-center justify-center gap-2 shadow-md shadow-black/10 transition-all duration-200 hover:opacity-95 hover:shadow-lg active:scale-[0.99]"
                    onClick={handleViewMap}
                  >
                    <FaLocationCrosshairs className="transition-transform duration-200 group-hover:rotate-45" />
                    {t("use_my_current_location")}
                  </button>

                  {/* Address search sits directly under the location button:
                      both answer "where am I", while the zone chips below are
                      the coarser "which area" fallback. */}
                  <div className="relative mt-3">
                    <div className="relative">
                      <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-base SecondaryTextColor" />
                      <input
                        ref={inputDomRef}
                        type="text"
                        role="combobox"
                        aria-expanded={resultedPlaces?.suggestions?.length > 0}
                        aria-controls="location-suggestions-listbox"
                        aria-activedescendant={
                          highlightedIndex >= 0
                            ? `location-suggestion-${highlightedIndex}`
                            : undefined
                        }
                        aria-autocomplete="list"
                        value={inputValue}
                        placeholder={t("search_delivery_location")}
                        className="w-full py-3.5 pl-11 pr-14 buttonBackground outline-none rounded-xl text-sm border border-gray-200 dark:border-zinc-700 focus:border-[var(--primary-color)] transition-all duration-200 placeholder:SecondaryTextColor"
                        onChange={(event) => {
                          handleInputChange(event);
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleViewMap}
                        aria-label={t("use_my_current_location")}
                        className="primaryLightBack absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-lg primaryColor transition-opacity duration-200 hover:opacity-80"
                      >
                        <FaLocationCrosshairs size={15} />
                      </button>
                    </div>
                    {resultedPlaces?.suggestions?.length > 0 && (
                      <div
                        id="location-suggestions-listbox"
                        className="absolute z-10 mt-1 w-full bg-white dark:bg-zinc-900 rounded-xl shadow-xl ring-1 ring-black/5 max-h-[220px] overflow-y-auto"
                        role="listbox"
                      >
                        {resultedPlaces?.suggestions?.map((item, index) => (
                          <div
                            role="option"
                            id={`location-suggestion-${index}`}
                            aria-selected={highlightedIndex === index}
                            key={index}
                            className={`flex items-start gap-2 px-3 py-2.5 cursor-pointer transition-colors duration-150 border-b border-gray-50 dark:border-zinc-800 last:border-b-0 ${
                              highlightedIndex === index
                                ? "primaryBackColor text-white"
                                : "hover:bg-gray-50 dark:hover:bg-zinc-800"
                            }`}
                            onClick={() =>
                              handleSelectLocation(item.placePrediction)
                            }
                          >
                            <FaLocationCrosshairs
                              className={`mt-0.5 shrink-0 text-xs ${
                                highlightedIndex === index
                                  ? "text-white"
                                  : "primaryColor"
                              }`}
                            />
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate">
                                {
                                  item?.placePrediction.structuredFormat
                                    .mainText.text
                                }
                              </div>
                              <div
                                className={`text-xs truncate ${
                                  highlightedIndex === index
                                    ? "text-white/80"
                                    : "SecondaryTextColor"
                                }`}
                              >
                                {
                                  item?.placePrediction.structuredFormat
                                    .secondaryText?.text
                                }
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between my-5 gap-3">
                    <hr className="flex-grow border-t border-solid border-gray-200 dark:border-zinc-700" />
                    <span className="rounded-full  px-3 py-1 text-[11px] font-semibold SecondaryTextColor uppercase tracking-wider">
                      {t("or") || "OR"}
                    </span>
                    <hr className="flex-grow border-t border-solid border-gray-200 dark:border-zinc-700" />
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full buttonBackground dark:bg-white/10">
                      <MdLocationPin size={20} className="primaryColor" />
                    </span>
                    <div className="flex flex-col gap-0.5 flex-1 min-w-0">
                      <span className="text-sm font-semibold textColor">
                        {t("where_do_we_deliver") || "Pick your delivery zone"}
                      </span>
                      {!zonesLoading && countryZones.length > 0 && (
                        <span className="text-xs SecondaryTextColor">
                          {t("we_deliver_to") || "We deliver to"}{" "}
                          {countryZones.length}{" "}
                          {t("zones_across") || "zones across"}{" "}
                          {selectedCountry?.name}
                          {". "}
                          {t("choose_nearest_zone") ||
                            "Choose the one nearest to you."}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Sits BETWEEN the zone heading and the zone chips: the heading
                      names the task, this qualifies which country's zones follow,
                      then the chips answer it. On its own row at the section's left
                      edge — inside the heading row it landed in the pin icon's
                      column and lined up with nothing. */}
                  {selectedCountry && countries.length > 1 && (
                    <div className="mb-1 mt-2 flex items-center gap-2 text-sm">
                      <span className="SecondaryTextColor">
                        {t("delivering_to") || "Delivering to"}
                      </span>
                      <div className="relative" ref={countryRef}>
                        <button
                          type="button"
                          onClick={() => setCountryOpen((prev) => !prev)}
                          aria-haspopup="listbox"
                          aria-expanded={countryOpen}
                          aria-label={t("select_country") || "Select country"}
                          className={`flex items-center gap-1.5 rounded-[5px] border px-2 py-1.5 transition-colors duration-200 ${
                            countryOpen
                              ? "primaryBorderColor primaryLightBack"
                              : "border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:border-[var(--primary-color)]"
                          }`}
                        >
                          {selectedCountry?.logo_url && (
                            <Image
                              src={selectedCountry.logo_url}
                              alt=""
                              width={18}
                              height={13}
                              className="h-[13px] w-[18px] shrink-0 rounded-[2px] object-cover"
                            />
                          )}
                          <span className="max-w-[120px] truncate font-semibold textColor">
                            {selectedCountry?.name}
                          </span>
                          <FiChevronDown
                            size={13}
                            className={`shrink-0 opacity-60 transition-transform duration-200 ${
                              countryOpen ? "rotate-180" : ""
                            }`}
                          />
                        </button>

                        {/* Anchored to the chip's own width, capped at ~5 rows. */}
                        {countryOpen && (
                          <ul
                            role="listbox"
                            aria-label={t("select_country") || "Select country"}
                            onKeyDown={handleCountryListKeyDown}
                            className="absolute start-0 top-full z-[60] mt-1.5 max-h-[200px] w-[200px] overflow-y-auto rounded-[5px] border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-1 shadow-lg"
                          >
                            {countries.map((country, index) => (
                              <li key={country?.id}>
                                <button
                                  type="button"
                                  role="option"
                                  ref={(el) =>
                                    (countryOptionRefs.current[index] = el)
                                  }
                                  tabIndex={index === 0 ? 0 : -1}
                                  aria-selected={
                                    selectedCountry?.id === country?.id
                                  }
                                  onClick={() => handleCountryChange(country)}
                                  className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-start text-[13px] transition-colors duration-200 hover:bg-gray-50 dark:hover:bg-zinc-800 ${
                                    selectedCountry?.id === country?.id
                                      ? "primaryColor font-semibold"
                                      : "textColor"
                                  }`}
                                >
                                  {country?.logo_url && (
                                    <Image
                                      src={country.logo_url}
                                      alt=""
                                      width={18}
                                      height={13}
                                      className="h-[13px] w-[18px] shrink-0 rounded-[2px] object-cover"
                                    />
                                  )}
                                  <span className="flex-1 truncate">
                                    {country?.name}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedCountry && (
                    <div className="flex flex-col gap-3 mb-4">
                      {renderZonesContent(
                        zonesLoading,
                        countryZones,
                        selectedZone,
                        checkingZone,
                        handleSelectZone,
                      )}

                      {/* Illustration bleeds to the right edge — no tile behind
                          it, so the artwork sits directly on the tinted panel. */}
                      {!zonesLoading && countryZones.length > 0 && (
                        <div className="primaryLightBack relative flex items-center gap-3 overflow-hidden rounded-lg py-2 pl-2 pr-28 mt-2 ">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/70 dark:bg-white/10 ">
                            <MdLocationPin size={24} className="primaryColor" />
                          </span>
                          <div className="flex flex-col ">
                            <span className="text-sm font-bold textColor">
                              {t("dont_see_your_area") ||
                                "Don't see your area?"}
                            </span>
                            <span className="text-xs SecondaryTextColor">
                              {t("always_expanding") ||
                                "We're always expanding. Stay tuned!"}
                            </span>
                          </div>

                          <ThemedSvg
                            src={location}
                            alt=""
                            aria-hidden="true"
                            className="pointer-events-none absolute right-4 top-1/2 h-10 w-12 -translate-y-1/2 [&>svg]:!h-full [&>svg]:!w-full"
                          />
                        </div>
                      )}
                    </div>
                  )}

                  {errorMessage !== "" && (
                    <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-400">
                      {errorMessage}
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-3 w-full">
                  {/* Search a place to recenter the map/marker */}
                  <div className="relative w-full">
                    <FaLocationCrosshairs className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm SecondaryTextColor" />
                    <input
                      type="text"
                      role="combobox"
                      aria-expanded={mapResults?.suggestions?.length > 0}
                      aria-controls="map-suggestions-listbox"
                      aria-activedescendant={
                        mapHighlightedIndex >= 0
                          ? `map-suggestion-${mapHighlightedIndex}`
                          : undefined
                      }
                      aria-autocomplete="list"
                      value={mapSearchValue}
                      placeholder={t("search_delivery_location")}
                      className="w-full py-3 pl-9 pr-3 buttonBackground outline-none rounded-xl text-sm border border-transparent focus:border-[var(--primary-color)] transition-all duration-200 placeholder:textColor"
                      onChange={handleMapSearchInput}
                      onKeyDown={handleMapKeyDown}
                    />
                    {mapResults?.suggestions?.length > 0 && (
                      <div
                        id="map-suggestions-listbox"
                        className="absolute z-[1100] mt-1 w-full bg-white dark:bg-zinc-900 rounded-xl shadow-xl ring-1 ring-black/5 max-h-[220px] overflow-y-auto overflow-hidden"
                        role="listbox"
                      >
                        {mapResults?.suggestions?.map((item, index) => (
                          <div
                            role="option"
                            id={`map-suggestion-${index}`}
                            aria-selected={mapHighlightedIndex === index}
                            key={index}
                            className={`flex items-start gap-2 px-3 py-2.5 cursor-pointer transition-colors duration-150 border-b border-gray-50 dark:border-zinc-800 last:border-b-0 ${
                              mapHighlightedIndex === index
                                ? "primaryBackColor text-white"
                                : "hover:bg-gray-50 dark:hover:bg-zinc-800"
                            }`}
                            onClick={() =>
                              handleMapSelectLocation(item.placePrediction)
                            }
                          >
                            <FaLocationCrosshairs className="mt-0.5 shrink-0 text-xs primaryColor" />
                            <div className="min-w-0">
                              <div className="font-medium text-sm truncate textColor">
                                {
                                  item?.placePrediction.structuredFormat
                                    .mainText.text
                                }
                              </div>
                              <div className="text-xs truncate SecondaryTextColor">
                                {
                                  item?.placePrediction.structuredFormat
                                    .secondaryText?.text
                                }
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {selectedZone && (
                    <div className="flex items-center gap-2 text-xs SecondaryTextColor">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 px-2.5 py-1 dark:border-zinc-700">
                        <span className="h-2 w-2 rounded-full bg-[#2563eb]" />
                        <span className="textColor font-medium">
                          {selectedZone.name}
                        </span>
                      </span>
                      <span>
                        {t("drag_pin_in_zone") ||
                          "Drag the pin to your exact address"}
                      </span>
                    </div>
                  )}
                  <div className="w-full flex flex-col gap-4">
                    {mapView ? (
                      <div className="overflow-hidden rounded-xl ring-1 ring-black/5 shadow-sm">
                        <MapWrapper
                          latitude={center?.lat}
                          longitude={center?.lng}
                          zoom={11}
                          // Viewport-relative so the Confirm button below stays
                          // reachable on short screens: a fixed 360px map pushed
                          // it past the modal's 92vh cap and out of sight.
                          height="min(360px, 42vh)"
                          draggableMarker
                          onMarkerDragEnd={handleDragEnd}
                          onMapClick={handleMapClick}
                          polygon={selectedZone?.boundary}
                          fitToMarkers={selectedZone?.boundary?.length >= 3}
                        />
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-xl buttonBackground px-3 py-2.5">
                    <p className="text-sm textColor flex gap-1.5">
                      <FaLocationCrosshairs className="mt-0.5 shrink-0 primaryColor" />
                      <span>
                        <b className="font-semibold">{t("address")}: </b>
                        {addressLoading ? (
                          <span className="SecondaryTextColor">....</span>
                        ) : (
                          localLocation.formatted_address
                        )}
                      </span>
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleConfirmLocation()}
                    className="w-full primaryBackColor text-white py-3 rounded-xl text-sm font-semibold shadow-md shadow-black/10 transition-all duration-200 hover:opacity-95 active:scale-[0.99]"
                  >
                    {t("confirm")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapView(false)}
                    className="w-full py-2.5 rounded-xl text-sm font-medium SecondaryTextColor hover:textColor hover:buttonBackground transition-colors duration-200"
                  >
                    {t("go_back")}
                  </button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default Location;
