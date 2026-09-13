import React, { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { t } from "@/utils/translation";
import { RiCloseFill } from "react-icons/ri";
import * as api from "@/api/apiRoutes";
import { BiCurrentLocation } from "react-icons/bi";
import { FiSearch } from "react-icons/fi";
import Loader from "../loader/Loader";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import useGeocode from "@/hooks/useGeocode";
import MapWrapper from "@/components/maps/MapWrapper";
import PhoneNumberInput from "@/components/phonenumberinput/PhoneNumberInput";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import useDir from "@/hooks/useDir";
import { setCity } from "@/redux/slices/citySlice";
import { setSelectedZone } from "@/redux/slices/locationModalSlice";
import type { MapLatLng } from "@/components/maps/types";

interface AddressDetails {
  name: string;
  mobile_num: string;
  // Omitted by two reset call sites in this file (pre-existing in the .jsx —
  // they simply leave these keys undefined at runtime); optional here to
  // match that existing behavior rather than inventing a default value.
  country_code?: string;
  alternate_mobile_num: string;
  alternate_country_code?: string;
  address: string;
  landmark: string;
  city: string;
  area: string;
  pincode: string;
  state: string;
  country: string;
  country_id?: string;
  region_id?: string;
  address_type: string;
  is_default: boolean;
}

interface LocalLocation {
  city?: string;
  formatted_address?: string;
  lat?: number;
  lng?: number;
}

interface MapCenter {
  lat?: number;
  lng?: number;
  streetViewControl?: boolean;
}

interface NewAddressModalProps {
  showAddAddres: boolean;
  setShowAddAddres: (value: boolean) => void;
  isAddressSelected: boolean;
  // Called with no args to just refetch, or with { selectNewestFrom } to
  // auto-select the newly added address in the parent (checkout).
  fetchAddress: (opts?: { selectNewestFrom?: any[] }) => void;
}

const NewAddressModal = ({
  showAddAddres,
  setShowAddAddres,
  isAddressSelected,
  fetchAddress,
}: NewAddressModalProps) => {
  const dispatch = useDispatch();
  const addresses = useSelector((state: any) => state.Addresses);
  const city = useSelector((state: any) => state.City.city);
  const language = useSelector((state: any) => state.Language.selectedLanguage);
  const dir = useDir();
  const { reverseGeocode, forwardGeocode } = useGeocode();
  const [addressLoading, setAddressLoading] = useState<boolean | string>("");
  const [loading, setLoading] = useState(false);
  const [center, setCenter] = useState<MapCenter | undefined>();
  // Serviceability of the current pin: null = not yet checked, true = inside a
  // zone, false = outside all zones (save blocked). Checked on the map pin (drag,
  // search, current-location) via a debounced getZone call.
  const [zoneServiceable, setZoneServiceable] = useState<boolean | null>(null);
  const [zoneChecking, setZoneChecking] = useState(false);
  const zoneCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Per-country length verdicts from the two PhoneNumberInputs
  // (min/max_mobile_length on each field's own selected country). Kept separate
  // so the primary and alternate numbers can't mask each other's error.
  const [mobileLengthError, setMobileLengthError] = useState<string | null>(null);
  const [altMobileLengthError, setAltMobileLengthError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [addressDetails, setaddressDetails] = useState<AddressDetails>({
    name: "",
    mobile_num: "",
    country_code: "",
    alternate_mobile_num: "",
    alternate_country_code: "",
    address: "",
    landmark: "",
    city: "",
    area: "",
    pincode: "",
    state: "",
    country: "",
    country_id: "",
    region_id: "",
    address_type: "Home",
    is_default: true,
  });
  const [regions, setRegions] = useState<any[]>([]);
  // Whether the region list has been fetched (successfully or not) for the
  // currently selected country — drives the region-select → free-text
  // fallback when a country has no regions on file.
  const [regionsLoaded, setRegionsLoaded] = useState(false);
  const [countries, setCountries] = useState<any[]>([]);

  const [localLocation, setlocalLocation] = useState<LocalLocation>({
    city: "",
    formatted_address: "",
    lat: parseFloat("0"),
    lng: parseFloat("0"),
  });

  useEffect(() => {
    // Editing keeps the saved address geocode (handled below); only auto-detect
    // for a fresh address.
    if (isAddressSelected) return;
    if (!navigator.geolocation) return;

    // Fallback to the app's selected city so the map never lands on 0,0 (ocean)
    // when geolocation is denied, times out, or the origin is non-HTTPS.
    const cityLat = parseFloat(city?.latitude);
    const cityLng = parseFloat(city?.longitude);
    const fallbackToCity = () => {
      if (cityLat && cityLng) {
        setlocalLocation({ lat: cityLat, lng: cityLng });
      }
    };

    navigator.geolocation.getCurrentPosition(
      (position: GeolocationPosition) => {
        setlocalLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error: GeolocationPositionError) => {
        console.warn(
          "Geolocation failed, using city fallback:",
          error?.message,
        );
        fallbackToCity();
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 },
    );
  }, [showAddAddres, isAddressSelected, city?.latitude, city?.longitude]);

  useEffect(() => {
    const center = {
      lat: localLocation.lat,
      lng: localLocation.lng,
      streetViewControl: false,
    };
    // Intentional sync setState: derives the map's center from localLocation.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCenter(center);
  }, [localLocation.lat, localLocation.lng]);

  // Debounce the search box so we hit the places API once the user pauses, not
  // on every keystroke.
  useEffect(() => {
    const q = searchQuery.trim();
    if (q.length < 3) {
      // Intentional sync setState: clears stale results when the query is too short.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    const id = setTimeout(async () => {
      try {
        const response = await api.getPlaces({ input: q });
        // API shape: data.suggestions[].placePrediction — unwrap to the
        // prediction objects the dropdown/pick handler consume.
        const predictions =
          response?.status === 1
            ? (response.data?.suggestions || [])
                .map((s: any) => s.placePrediction)
                .filter(Boolean)
            : [];
        setSearchResults(predictions);
        setShowResults(true);
      } catch (error: any) {
        console.warn("Location search failed:", error?.message);
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 400);
    return () => clearTimeout(id);
  }, [searchQuery]);

  useEffect(() => {
    // In edit mode keep the address's SAVED coordinates — forward-geocoding the
    // text returns an approximate point and would clobber the exact saved pin.
    if (isAddressSelected) return;
    if (addressDetails.address !== "") {
      const fullAddress = `${addressDetails.address}, ${addressDetails.city}, ${addressDetails.state}, ${addressDetails.country}`;
      forwardGeocode(fullAddress)
        .then((loc) => {
          if (loc) setlocalLocation({ lat: loc.lat, lng: loc.lng });
        })
        .catch((error: any) => {
          console.error("Forward geocode failed:", error?.message);
        });
    }
  }, [addressDetails, isAddressSelected, forwardGeocode]);

  // Fetch the country list once per modal open, for the new Country <select>.
  useEffect(() => {
    if (!showAddAddres) return;
    let cancelled = false;
    api
      .getCountriesWithDefault()
      .then((response: any) => {
        if (cancelled) return;
        setCountries(response?.data || []);
      })
      .catch((error: any) => {
        console.warn("[address] country fetch failed:", error?.message);
      });
    return () => {
      cancelled = true;
    };
  }, [showAddAddres]);

  // The saved address only carries `country` as a name string (no
  // country_id in the API response) — once the country list loads, resolve
  // the matching id by name so the Country <select> can show a selection and
  // the region fetch below can key off it. Only runs when country_id is
  // still empty, so it never clobbers a country the user just picked.
  useEffect(() => {
    if (addressDetails.country_id || !addressDetails.country || !countries.length) {
      return;
    }
    const match = countries.find(
      (c: any) =>
        String(c.name).trim().toLowerCase() ===
        String(addressDetails.country).trim().toLowerCase(),
    );
    if (match) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resolves country_id from saved country name once list loads; not derivable from render
      setaddressDetails((state) => ({ ...state, country_id: String(match.id) }));
    }
  }, [countries, addressDetails.country, addressDetails.country_id]);

  // Fetch the region list whenever the selected country changes.
  useEffect(() => {
    if (!showAddAddres || !addressDetails.country_id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clears stale region list when country is unset; not derivable from render
      setRegions([]);
      setRegionsLoaded(false);
      return;
    }
    let cancelled = false;
    setRegionsLoaded(false);
    api
      .getRegions({ country_id: addressDetails.country_id })
      .then((response: any) => {
        if (cancelled) return;
        setRegions(response?.status == 1 ? response.data || [] : []);
        setRegionsLoaded(true);
      })
      .catch((error: any) => {
        console.warn("[address] region fetch failed:", error?.message);
        if (cancelled) return;
        setRegions([]);
        setRegionsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [showAddAddres, addressDetails.country_id]);

  // Reset serviceability whenever the modal (re)opens — a stale "out of zone"
  // flag from a previous session must not block a fresh address.
  useEffect(() => {
    // Intentional sync setState: resets a stale flag when the modal reopens.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (showAddAddres) setZoneServiceable(null);
  }, [showAddAddres]);

  useEffect(() => {
    if (isAddressSelected && addresses.selectedEditAddress) {
      // Drop the map pin on the address's SAVED coordinates (else it defaults to
      // 0,0 / city center and the edit map doesn't match the address).
      const savedLat = parseFloat(addresses.selectedEditAddress.latitude);
      const savedLng = parseFloat(addresses.selectedEditAddress.longitude);
      if (savedLat && savedLng) {
        // Intentional sync setState: seeds the pin from the saved address's coords.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setlocalLocation({ lat: savedLat, lng: savedLng });
      }
      setaddressDetails({
        name: addresses.selectedEditAddress.name,
        mobile_num: addresses.selectedEditAddress.mobile,
        country_code: addresses.selectedEditAddress.country_code,
        alternate_mobile_num: addresses.selectedEditAddress.alternate_mobile,
        alternate_country_code:
          addresses.selectedEditAddress.alternate_country_code,
        address: addresses.selectedEditAddress.address,
        landmark: addresses.selectedEditAddress.landmark,
        city: addresses.selectedEditAddress.city,
        area: addresses.selectedEditAddress.area,
        pincode: addresses.selectedEditAddress.pincode,
        state: addresses.selectedEditAddress.state,
        country: addresses.selectedEditAddress.country,
        country_id: addresses.selectedEditAddress.country_id
          ? String(addresses.selectedEditAddress.country_id)
          : "",
        region_id: addresses.selectedEditAddress.region_id
          ? String(addresses.selectedEditAddress.region_id)
          : "",
        address_type: addresses.selectedEditAddress.type,
        is_default:
          addresses.selectedEditAddress.is_default === 1 ? true : false,
      });
    } else {
      setlocalLocation({
        lat: parseFloat(city?.latitude ? city?.latitude : 0),
        lng: parseFloat(city?.longitude ? city?.longitude : 0),
      });
      setaddressDetails({
        name: "",
        mobile_num: "",
        alternate_mobile_num: "",
        address: "",
        landmark: "", 
        city: "",
        area: "",
        pincode: "",
        state: "",
        country: "",
        country_id: "",
        region_id: "",
        address_type: "Home",
        is_default: true,
      });
    }
  }, [
    isAddressSelected,
    addresses?.selectedEditAddress,
    showAddAddres,
    city?.latitude,
    city?.longitude,
  ]);

  // When the saved address falls in a DIFFERENT zone than the one currently
  // selected, adopt that zone so the catalogue, serviceability and channel match
  // the address the user just chose. Mirrors the location modal's resolve →
  // setCity flow (getZone by coords). Never throws into the save path — a failed
  // resolve just leaves the current zone in place.
  const adoptZoneForAddress = async (lat: number | undefined, lng: number | undefined) => {
    try {
      const result = await api.getZone({
        latitude: lat,
        longitude: lng,
        skipChannel: true,
      });
      if (result?.status != 1 || !result?.data) return;
      // Same zone already selected — nothing to switch.
      if (
        city?.zone_id != null &&
        Number(result.data.zone_id) === Number(city.zone_id)
      ) {
        return;
      }
      dispatch(
        setCity({
          data: {
            id: result.data.id,
            name: addressDetails.city || city?.name || "",
            state: result.data.state,
            formatted_address:
              addressDetails.address || city?.formatted_address || "",
            latitude: lat,
            longitude: lng,
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
      // Keep selectedZone (drives zone URLs / catalogue) in sync when the API
      // returns the zone's slug.
      if (result.data.slug) {
        dispatch(
          setSelectedZone({
            id: result.data.zone_id ?? null,
            name: result.data.name ?? null,
            slug: result.data.slug,
          }),
        );
      }
    } catch (error: any) {
      console.warn("[address] zone adopt failed:", error?.message);
    }
  };

  const handleConfirmAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    // Block saving an address outside every serviceable zone (button is also
    // disabled; this guards a programmatic/enter-key submit).
    if (zoneServiceable === false) {
      toast.error(
        t("address_out_of_service_zone") ||
          "We don't deliver to this location.",
      );
      return;
    }
    // Either number outside its own country's min/max_mobile_length blocks the
    // save (button is also disabled; this guards an enter-key submit). An empty
    // alternate number yields no error, so it stays optional.
    if (mobileLengthError || altMobileLengthError) {
      toast.error(mobileLengthError || altMobileLengthError);
      return;
    }
    let lat = center?.lat;
    let lng = center?.lng;
    if (!isAddressSelected) {
      setLoading(true);
      // Snapshot existing address ids so the parent can auto-select the one
      // we're about to add (addAddress doesn't reliably return the new id).
      const prevIds = (addresses?.allAddresses || []).map((a: any) => a.id);
      const response = await api.addAddress({
        name: addressDetails.name,
        mobile: addressDetails.mobile_num,
        country_code: addressDetails.country_code,
        alternate_country_code: addressDetails.alternate_country_code,
        type: addressDetails.address_type,
        address: addressDetails.address,
        landmark: addressDetails.landmark,
        area: addressDetails.area,
        pincode: addressDetails.pincode,
        city: addressDetails.city,
        state: addressDetails.state,
        country: addressDetails.country,
        region_id:
          regions.length > 0 ? addressDetails.region_id || undefined : undefined,
        alternate_mobile: addressDetails.alternate_mobile_num,
        latitiude: lat,
        longitude: lng,
        is_default: addressDetails.is_default,
      });
      if (response.status == 1) {
        // Adopt the address's zone if it differs from the current one, so the
        // catalogue follows the address the user just added.
        await adoptZoneForAddress(lat, lng);
        // Auto-select the newly added address in the parent (checkout).
        fetchAddress({ selectNewestFrom: prevIds });
        setLoading(false);
        toast.success(t("address_added_success"));
        setaddressDetails({
          name: "",
          mobile_num: "",
          alternate_mobile_num: "",
          address: "",
          landmark: "",
          city: "",
          area: "",
          pincode: "",
          state: "",
          country: "",
          region_id: "",
          address_type: "Home",
          is_default: false,
        });
        setShowAddAddres(false);
      } else {
        // Keep modal open on failure so the user can fix the input
        // (e.g. missing mobile) instead of silently closing.
        setLoading(false);
        toast.error(response.message || t("something_went_wrong"));
      }
    } else {
      setLoading(true);
      const response = await api.updateAddress({
        id: addresses.selectedEditAddress.id,
        name: addressDetails.name,
        mobile: addressDetails.mobile_num,
        country_code: addressDetails.country_code,
        alternate_country_code: addressDetails.alternate_country_code,
        type: addressDetails.address_type,
        address: addressDetails.address,
        landmark: addressDetails.landmark,
        area: addressDetails.area,
        pincode: addressDetails.pincode,
        city: addressDetails.city,
        state: addressDetails.state,
        country: addressDetails.country,
        region_id:
          regions.length > 0 ? addressDetails.region_id || undefined : undefined,
        alternate_mobile: addressDetails.alternate_mobile_num,
        latitiude: lat,
        longitude: lng,
        is_default: addressDetails.is_default,
      });
      if (response.status === 1) {
        // Adopt the edited address's zone if it changed (e.g. the pin moved into
        // another zone), so the catalogue follows it.
        await adoptZoneForAddress(lat, lng);
        toast.success("Succesfully Updated Address!");
        fetchAddress();
        setShowAddAddres(false);
        setLoading(false);
      } else {
        setLoading(false);
        toast.error(response.message || t("something_went_wrong"));
      }
    }
  };

  const handleHideAddressModal = () => {
    setaddressDetails({
      name: "",
      mobile_num: "",
      country_code: "",
      alternate_mobile_num: "",
      alternate_country_code: "",
      address: "",
      landmark: "",
      city: "",
      area: "",
      pincode: "",
      state: "",
      country: "",
      country_id: "",
      region_id: "",
      address_type: "Home",
      is_default: false,
    });
    setShowAddAddres(false);
  };

  // Debounced serviceability check for a dropped/selected pin. getZone returns
  // status 1 with zone data when the point is inside a serviceable zone; anything
  // else means it's outside coverage and the address can't be saved. Debounced so
  // dragging the pin doesn't fire a request on every intermediate position.
  const checkZoneServiceable = (lat?: number | null, lng?: number | null) => {
    if (zoneCheckTimer.current) clearTimeout(zoneCheckTimer.current);
    if (lat == null || lng == null) return;
    setZoneChecking(true);
    zoneCheckTimer.current = setTimeout(async () => {
      try {
        const result = await api.getZone({
          latitude: lat,
          longitude: lng,
          skipChannel: true,
        });
        const ok = result?.status == 1 && !!result?.data;
        setZoneServiceable(ok);
        // Immediate feedback: the API's own message ("We doesn't delivery at
        // selected city") is shown as a toast the moment the point resolves as
        // out-of-zone, independent of the form's loading state. The inline banner
        // + disabled Confirm reinforce it.
        if (!ok) {
          toast.error(
            result?.message ||
              t("address_out_of_service_zone") ||
              "We don't deliver to this location.",
          );
        }
      } catch (error: any) {
        console.warn("[address] zone check failed:", error?.message);
        // On a failed check, don't hard-block the user — leave it serviceable so
        // a transient network error can't trap a valid in-zone address.
        setZoneServiceable(true);
      } finally {
        setZoneChecking(false);
      }
    }, 500);
  };

  // Clear the debounce timer on unmount.
  useEffect(() => {
    return () => {
      if (zoneCheckTimer.current) clearTimeout(zoneCheckTimer.current);
    };
  }, []);

  const onMarkerDragEnd = async ({ lat, lng }: MapLatLng) => {
    // Re-check serviceability for the newly dropped pin.
    checkZoneServiceable(lat, lng);
    const prev_latlng = {
      lat: localLocation.lat,
      lng: localLocation.lng,
    };

    // Move the pin immediately so it stays where dropped while the (async)
    // reverse-geocode runs; otherwise a re-render snaps it back to the old
    // center. Only revert if geocoding yields nothing usable.
    setlocalLocation({ lat, lng });
    setAddressLoading(true);
    try {
      const result = await reverseGeocode(lat, lng);
      if (result) {
        // Keep the dropped pin even on a sparse result; only revert when
        // the provider returns nothing usable at all.
        if (result.address === "" && result.area === "") {
          setlocalLocation({ lat: prev_latlng.lat, lng: prev_latlng.lng });
        } else {
          setaddressDetails((state) => ({
            ...state,
            address: result.address,
            landmark: result.landmark,
            city: result.city,
            area: result.area,
            pincode: result.pincode,
            country: result.country,
            state: result.state,
          }));
        }
      }
    } catch (error: any) {
      console.log(error);
    } finally {
      setAddressLoading(false);
    }
  };

  const handleSelectSearchResult = async (place: any) => {
    setShowResults(false);
    setSearchResults([]);
    setSearchQuery("");
    setAddressLoading(true);
    try {
      // The autocomplete row already carries coordinates in `_osm`; use them
      // and skip the extra places_details round-trip.
      let lat = place?._osm?.lat;
      let lng = place?._osm?.lon;
      if (lat == null || lng == null) {
        const response = await api.getPlacesDetails({ placeId: place.placeId });
        if (response?.status !== 1) {
          toast.error(response?.message || t("something_went_wrong"));
          return;
        }
        lat = response.data.location.latitude;
        lng = response.data.location.longitude;
      }
      const latLng = { lat: parseFloat(lat), lng: parseFloat(lng) };
      setCenter(latLng);
      setlocalLocation(latLng);
      checkZoneServiceable(latLng.lat, latLng.lng);

      // Reverse-geocode the point to fill the flat address form fields.
      const result = await reverseGeocode(latLng.lat, latLng.lng);
      if (result) {
        setaddressDetails((state) => ({
          ...state,
          address: result.address,
          landmark: result.landmark,
          city: result.city,
          area: result.area,
          pincode: result.pincode,
          country: result.country,
          state: result.state,
        }));
      }
    } catch (error: any) {
      console.warn("Place details lookup failed:", error?.message);
      toast.error(t("something_went_wrong"));
    } finally {
      setAddressLoading(false);
    }
  };

  const handleCurrentLocationClick = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position: GeolocationPosition) => {
          const latLng = {
            lat: parseFloat(String(position.coords.latitude)),
            lng: parseFloat(String(position.coords.longitude)),
          };
          setCenter(latLng);
          setlocalLocation(latLng);
          checkZoneServiceable(latLng.lat, latLng.lng);

          try {
            const result = await reverseGeocode(latLng.lat, latLng.lng);
            if (result) {
              setaddressDetails((state) => ({
                ...state,
                address: result.address,
                landmark: result.landmark,
                city: result.city,
                area: result.area,
                pincode: result.pincode,
                country: result.country,
                state: result.state,
              }));
            } else {
              console.log("No result found");
            }
          } catch (error: any) {
            console.log(error);
          }
        },
        (error: GeolocationPositionError) => {
          console.error("Error detecting location", error);
        },
        {
          // FIX: Crucial for mobile devices to get an actual GPS lock
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0,
        },
      );
    } else {
      console.log("geolocation not present in navigator");
    }
  };

  // Dial code + number come from PhoneNumberInput, which fetches the country
  // list from the API and owns the picker. It emits { dialCode, rawPhone }.
  // `country` in onCountryReady payloads is the raw API country row — `any`
  // per the established boundary policy for country/phone data.
  const handleMobileChange = ({
    dialCode,
    rawPhone,
    lengthError,
  }: {
    dialCode: string;
    rawPhone: string;
    lengthError?: string | null;
  }) => {
    setMobileLengthError(lengthError ?? null);
    setaddressDetails((state) => ({
      ...state,
      mobile_num: rawPhone,
      country_code: dialCode,
    }));
  };

  // The alternate number is optional: validateMobileLength returns null for an
  // empty value, so leaving it blank never sets an error here.
  const handleAlternateMobileChange = ({
    dialCode,
    rawPhone,
    lengthError,
  }: {
    dialCode: string;
    rawPhone: string;
    lengthError?: string | null;
  }) => {
    setAltMobileLengthError(lengthError ?? null);
    setaddressDetails((state) => ({
      ...state,
      alternate_mobile_num: rawPhone,
      alternate_country_code: dialCode,
    }));
  };

  // Seed the dial code before the user types, when adding a fresh address.
  const handleMobileCountryReady = (country: any) => {
    if (!country?.dial_code) return;
    setaddressDetails((state) =>
      state.country_code
        ? state
        : { ...state, country_code: country.dial_code },
    );
  };

  const handleAltMobileCountryReady = (country: any) => {
    if (!country?.dial_code) return;
    setaddressDetails((state) =>
      state.alternate_country_code
        ? state
        : { ...state, alternate_country_code: country.dial_code },
    );
  };

  const handleSetAddressType = (value: string) => {
    setaddressDetails((state) => ({ ...state, address_type: value }));
  };

  const handleCheckboxChange = (e: { target: { checked: boolean } }) => {
    setaddressDetails((prevDetails) => ({
      ...prevDetails,
      is_default: e.target.checked,
    }));
  };

  // region_id drives the save; `state` (free text) is kept in sync from the
  // picked region's name since the API's `state` param is still a string.
  // When the country has no region list (regions.length === 0), `regions`
  // has nothing to find by id — the caller passes the typed text directly,
  // which becomes both region_id and state.
  const handleRegionChange = (value: string) => {
    const picked = regions.find((r: any) => String(r.id) === value);
    setaddressDetails((state) => ({
      ...state,
      region_id: value,
      state: picked?.name ?? (regions.length === 0 ? value : state.state),
    }));
  };

  // country_id drives the region fetch; `country` (free text) stays in sync
  // for the API's `country` string param. Switching country invalidates the
  // previously picked region (it belonged to the old country's list).
  const handleCountryChange = (value: string) => {
    const picked = countries.find((c: any) => String(c.id) === value);
    setaddressDetails((state) => ({
      ...state,
      country_id: value,
      country: picked?.name ?? state.country,
      region_id: "",
      state: "",
    }));
  };

  return (
    <Dialog open={showAddAddres}>
      <DialogContent
        dir={dir === "RTL" ? "rtl" : "ltr"}
        className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto custom-scrollbar"
        title={t("new_address")}
      >
        <DialogHeader>
          <div className="flex flex-row justify-between items-center">
            <h2 className="font-bold text-xl">{t("new_address")}</h2>
            <div className="closeButtonBg rounded-full p-[8px] gap-[4px] cursor-pointer">
              <RiCloseFill size={22} onClick={() => handleHideAddressModal()} />
            </div>
          </div>
        </DialogHeader>
        <div className="p-2 ">
          <div className="flex gap-2.5 flex-col">
            {/* Search bar lives ABOVE the map so it never fights the zoom /
                current-location controls — clean on every screen size. */}
            <div className="relative z-[1001]">
              <FiSearch
                size={16}
                className="absolute start-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchResults.length && setShowResults(true)}
                placeholder={t("search_location")}
                className="w-full h-10 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 ps-9 pe-9 text-sm text-black dark:text-zinc-100 text-start outline-none shadow-sm focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary-color)_25%,transparent)]"
              />
              {searchQuery && (
                <RiCloseFill
                  size={18}
                  className="absolute end-2.5 top-1/2 -translate-y-1/2 text-gray-400 cursor-pointer"
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                    setShowResults(false);
                  }}
                />
              )}
              {showResults && (searchLoading || searchResults.length > 0) && (
                <ul className="absolute inset-x-0 top-full mt-1 z-[1002] max-h-56 overflow-y-auto rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-lg custom-scrollbar">
                  {searchLoading && (
                    <li className="px-3 py-2 text-sm text-gray-400">
                      {t("loading")}
                    </li>
                  )}
                  {!searchLoading &&
                    searchResults.map((place, i) => (
                      <li
                        key={place.placeId || i}
                        className="flex items-start gap-2 px-3 py-2 text-sm text-black dark:text-zinc-100 cursor-pointer hover:bg-gray-100 dark:hover:bg-zinc-700 border-b border-gray-100 dark:border-zinc-700 last:border-0"
                        onClick={() => handleSelectSearchResult(place)}
                      >
                        <BiCurrentLocation
                          size={16}
                          className="mt-0.5 shrink-0 text-gray-400"
                        />
                        <span className="flex flex-col">
                          <span className="font-medium">
                            {place.structuredFormat?.mainText?.text}
                          </span>
                          <span className="text-xs text-gray-500 line-clamp-1">
                            {place.structuredFormat?.secondaryText?.text}
                          </span>
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
            <div className="w-full relative h-[160px] md:h-[190px]">
              <div
                className="absolute z-[1000] top-[10px] right-[10px] bg-white dark:bg-zinc-800 p-[10px] cursor-pointer text-black dark:text-zinc-100 rounded-sm shadow"
                onClick={handleCurrentLocationClick}
              >
                <BiCurrentLocation size={20} className=" " />
              </div>
              <MapWrapper
                latitude={center?.lat as number}
                longitude={center?.lng as number}
                height="100%"
                className="h-full w-full [&>div]:h-full"
                draggableMarker
                onMarkerDragEnd={onMarkerDragEnd}
              />
            </div>
            {/* Out-of-zone banner — sits under the map, OUTSIDE the loading gate
                below, so it's visible the moment the pin resolves outside a zone
                (the form + its own banner are hidden while addressLoading). */}
            {zoneServiceable === false && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400">
                {t("address_out_of_service_zone") ||
                  "We don't deliver to this location. Please pick an address inside a serviceable area."}
              </div>
            )}
            <div className="w-full h-full">
              {addressLoading ? (
                <div className="flex items-center justify-center">
                  <Loader
                    width={Math.min(300, window.innerWidth - 40)}
                    height={Math.min(300, window.innerWidth - 40)}
                  />
                </div>
              ) : (
                <div className="flex flex-col">
                  <form
                    className="flex flex-col gap-2.5"
                    onSubmit={handleConfirmAddress}
                  >
                    <div className="flex flex-col gap-1.5">
                      <Label className="block text-sm font-bold border-b border-gray-100 pb-1.5">
                        {t("contact_details")}
                      </Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1 sm:col-span-2">
                          <Label>{t("name")}</Label>
                          <Input
                            type="text"
                            className="h-9"
                            placeholder={t("name")}
                            value={addressDetails.name}
                            onChange={(e) =>
                              setaddressDetails((state) => ({
                                ...state,
                                name: e.target.value,
                              }))
                            }
                            required
                          />
                        </div>
                        {/* Dial code varies in width (+1 vs +852), so an overlaid
                            placeholder would collide with it. A label above the field
                            states the purpose without overlapping the dial code. */}
                        <div className="flex flex-col gap-1">
                          <Label>{t("mobileNumber")}</Label>
                          <PhoneNumberInput
                            value={addressDetails.mobile_num || ""}
                            countryCode={addressDetails.country_code}
                            onChange={handleMobileChange}
                            onCountryReady={handleMobileCountryReady}
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label>{t("alt_mobile_no")}</Label>
                          <PhoneNumberInput
                            value={addressDetails.alternate_mobile_num || ""}
                            countryCode={addressDetails.alternate_country_code}
                            onChange={handleAlternateMobileChange}
                            onCountryReady={handleAltMobileCountryReady}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="block text-sm font-bold border-b border-gray-100 pb-1.5">
                        {t("address_details")}
                      </Label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1 sm:col-span-2">
                          <Label>{t("address")}</Label>
                          <Input
                            type="text"
                            className="h-9"
                            placeholder={t("address")}
                            value={addressDetails.address}
                            onChange={(e) =>
                              setaddressDetails((state) => ({
                                ...state,
                                address: e.target.value,
                              }))
                            }
                            required
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label>{t("enter_landmark")}</Label>
                          <Input
                            type="text"
                            className="h-9"
                            placeholder={t("enter_landmark")}
                            value={addressDetails.landmark}
                            onChange={(e) =>
                              setaddressDetails((state) => ({
                                ...state,
                                landmark: e.target.value,
                              }))
                            }
                            required
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label>{t("enter_area")}</Label>
                          <Input
                            type="text"
                            className="h-9"
                            placeholder={t("enter_area")}
                            value={addressDetails.area}
                            onChange={(e) =>
                              setaddressDetails((state) => ({
                                ...state,
                                area: e.target.value,
                              }))
                            }
                            required
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label>{t("enter_pincode")}</Label>
                          <Input
                            type="text"
                            className="h-9"
                            placeholder={t("enter_pincode")}
                            value={addressDetails.pincode}
                            onChange={(e) =>
                              setaddressDetails((state) => ({
                                ...state,
                                pincode: e.target.value,
                              }))
                            }
                            required
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label>{t("enter_city")}</Label>
                          <Input
                            type="text"
                            className="h-9"
                            placeholder={t("enter_city")}
                            value={addressDetails.city}
                            onChange={(e) =>
                              setaddressDetails((state) => ({
                                ...state,
                                city: e.target.value,
                              }))
                            }
                            required
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label>{t("enter_country")}</Label>
                          <Select
                            value={addressDetails.country_id || undefined}
                            onValueChange={handleCountryChange}
                          >
                            <SelectTrigger className="h-9 w-full">
                              <SelectValue placeholder={t("enter_country")} />
                            </SelectTrigger>
                            <SelectContent className="z-[1002]">
                              {countries.map((c: any) => (
                                <SelectItem key={c.id} value={String(c.id)}>
                                  {c.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Label>{t("enter_state")}</Label>
                          {/* Countries with no region list on file get a
                              free-text field instead of a stuck-empty
                              dropdown — region_id doubles as the typed name. */}
                          {regionsLoaded && regions.length === 0 ? (
                            <Input
                              type="text"
                              className="h-9"
                              placeholder={t("enter_state")}
                              value={addressDetails.region_id || ""}
                              onChange={(e) => handleRegionChange(e.target.value)}
                            />
                          ) : (
                            <Select
                              value={addressDetails.region_id || undefined}
                              onValueChange={handleRegionChange}
                              disabled={!addressDetails.country_id}
                            >
                              <SelectTrigger className="h-9 w-full">
                                <SelectValue placeholder={t("enter_state")} />
                              </SelectTrigger>
                              <SelectContent className="z-[1002]">
                                {regions.map((region: any) => (
                                  <SelectItem
                                    key={region.id}
                                    value={String(region.id)}
                                  >
                                    {region.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <Label className="block text-sm font-bold border-b border-gray-100 pb-1.5">
                        {t("address_type")}
                      </Label>
                      <div className="flex flex-wrap items-center gap-2">
                        {["Home", "Office", "Other"].map((type) => {
                          const labelKey =
                            type === "Home"
                              ? "adress_type_home"
                              : type === "Office"
                                ? "address_type_office"
                                : "address_type_other";
                          const active = addressDetails.address_type === type;
                          return (
                            <button
                              key={type}
                              type="button"
                              onClick={() => handleSetAddressType(type)}
                              className={`rounded-lg border px-4 py-1.5 text-sm font-semibold transition ${
                                active
                                  ? "primaryBackColor primaryColorBorder text-white"
                                  : "cardBorder textColor hover:primaryLightBack"
                              }`}
                            >
                              {t(labelKey)}
                            </button>
                          );
                        })}
                        <label className="ml-auto flex items-center gap-2.5 cursor-pointer">
                          <Checkbox
                            checked={addressDetails.is_default}
                            onCheckedChange={(checked) =>
                              handleCheckboxChange({
                                target: { checked: checked === true },
                              })
                            }
                          />
                          <span className="text-sm font-semibold textColor">
                            {t("set_as_default_address")}
                          </span>
                        </label>
                      </div>
                    </div>
                    <Button
                      type="submit"
                      className="primaryBackColor w-full rounded-lg py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
                      disabled={
                        loading ||
                        zoneChecking ||
                        zoneServiceable === false ||
                        !!mobileLengthError ||
                        !!altMobileLengthError
                      }
                    >
                      {loading
                        ? t("loading")
                        : zoneChecking
                          ? t("checking_serviceability") ||
                            "Checking availability…"
                          : t("confirm_location")}
                    </Button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NewAddressModal;
