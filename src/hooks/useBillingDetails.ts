"use client";

import { useEffect, useState } from "react";
import * as api from "@/api/apiRoutes";

/**
 * Billing-details form state for the place-order flow (checkout page + quick
 * checkout drawer). Transient per-order-attempt data — not persisted, so each
 * caller owns its own instance rather than sharing redux state.
 *
 * Mirrors the country/region <Select> pattern already proven in
 * NewAddressModal.tsx (fetch countries once, fetch regions on country change,
 * keep both the _id and the free-text name in sync since the API wants the
 * name string but the picker needs the id).
 */
export interface BillingDetailsState {
  sameAsShipping: boolean;
  name: string;
  mobile: string;
  countryCode: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  countryId: string;
  regionId: string;
}

const emptyBilling: BillingDetailsState = {
  sameAsShipping: true,
  name: "",
  mobile: "",
  countryCode: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  country: "",
  countryId: "",
  regionId: "",
};

export default function useBillingDetails() {
  const [billing, setBilling] = useState<BillingDetailsState>(emptyBilling);
  const [countries, setCountries] = useState<any[]>([]);
  const [regions, setRegions] = useState<any[]>([]);
  // Whether the region list has been fetched (successfully or not) for the
  // currently selected country — distinct from `regions.length === 0`, which
  // is also true before any country is picked. Drives the region-select →
  // free-text fallback: a country with no regions on file still needs a
  // region value typed in by hand rather than being stuck on an empty picker.
  const [regionsLoaded, setRegionsLoaded] = useState(false);

  // Fetch the country list once, for the Billing Country <select>.
  useEffect(() => {
    let cancelled = false;
    api
      .getCountriesWithDefault()
      .then((response: any) => {
        if (cancelled) return;
        setCountries(response?.data || []);
      })
      .catch((error: any) => {
        console.warn("[billing] country fetch failed:", error?.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch the region list whenever the selected billing country changes.
  useEffect(() => {
    if (!billing.countryId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clears stale region list when country is unset; not derivable from render
      setRegions([]);
      setRegionsLoaded(false);
      return;
    }
    let cancelled = false;
    setRegionsLoaded(false);
    api
      .getRegions({ country_id: billing.countryId })
      .then((response: any) => {
        if (cancelled) return;
        setRegions(response?.status == 1 ? response.data || [] : []);
        setRegionsLoaded(true);
      })
      .catch((error: any) => {
        console.warn("[billing] region fetch failed:", error?.message);
        if (cancelled) return;
        setRegions([]);
        setRegionsLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [billing.countryId]);

  const setField = <K extends keyof BillingDetailsState>(
    key: K,
    value: BillingDetailsState[K],
  ) => {
    setBilling((state) => ({ ...state, [key]: value }));
  };

  const setSameAsShipping = (checked: boolean) => setField("sameAsShipping", checked);

  const handleMobileChange = ({
    dialCode,
    rawPhone,
  }: {
    dialCode: string;
    rawPhone: string;
  }) => {
    setBilling((state) => ({ ...state, mobile: rawPhone, countryCode: dialCode }));
  };

  const handleMobileCountryReady = (country: any) => {
    if (!country?.dial_code) return;
    setBilling((state) =>
      state.countryCode ? state : { ...state, countryCode: country.dial_code },
    );
  };

  // country_id drives the region fetch; `country` (free text) stays in sync
  // for the API's string param. Switching country invalidates the previously
  // picked region (it belonged to the old country's list).
  const handleCountryChange = (value: string) => {
    const picked = countries.find((c: any) => String(c.id) === value);
    setBilling((state) => ({
      ...state,
      countryId: value,
      country: picked?.name ?? state.country,
      regionId: "",
      state: "",
    }));
  };

  // region_id drives the save; `state` (free text) is kept in sync from the
  // picked region's name since the API's billing_state param is a string.
  // When the country has no region list, `regions` has nothing to find by
  // id — the caller passes the typed text directly, which becomes both
  // regionId and state (same fallback as NewAddressModal.tsx).
  const handleRegionChange = (value: string) => {
    const picked = regions.find((r: any) => String(r.id) === value);
    setBilling((prev) => ({
      ...prev,
      regionId: value,
      state: picked?.name ?? (regions.length === 0 ? value : prev.state),
    }));
  };

  const reset = () => setBilling(emptyBilling);

  // A country whose region list came back empty has no picker to show — the
  // field falls back to free text instead (e.g. Italy, which this backend
  // has no region list for).
  const hasRegions = regionsLoaded && regions.length > 0;
  const regionsEmpty = regionsLoaded && regions.length === 0;
  // When there's no region list, regionId holds a typed NAME, not an id —
  // never send that as billing_region_id (the name already goes out as
  // billing_state). Only a real picked id, from an actual region list, is
  // sent.
  const regionIdToSend =
    regions.length > 0 ? billing.regionId || undefined : undefined;

  // Required whenever the user is providing a DIFFERENT billing address.
  const isValid =
    billing.sameAsShipping ||
    (!!billing.name && !!billing.mobile && !!billing.address && !!billing.city && !!billing.country);

  return {
    billing,
    countries,
    regions,
    regionsLoaded,
    hasRegions,
    regionsEmpty,
    regionIdToSend,
    setSameAsShipping,
    setField,
    handleMobileChange,
    handleMobileCountryReady,
    handleCountryChange,
    handleRegionChange,
    reset,
    isValid,
  };
}
