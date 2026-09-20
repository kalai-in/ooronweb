"use client";

import { useSelector } from "react-redux";
import useIsHydrated from "@/hooks/useIsHydrated";

/**
 * The app's single source of truth for currency display. `country_setting`
 * (src/api/apiRoutes.ts getCountrySetting) is zone-aware — refetched by
 * Layout.tsx whenever the city/zone changes — and is the ONLY currency value
 * that should be trusted, everywhere, always, including order-history/detail
 * pages for orders placed under a different zone. This app shows the
 * VIEWER'S CURRENT zone currency unconditionally (confirmed: switching to a
 * Dubai/AED zone must show AED on every page — active orders, order history,
 * order detail, wallet, payment-status — not just live checkout). Per-response
 * API fields (cart/checkout/order `currency`) and the global merchant
 * settings slice (state.Setting.setting, fetched once, not zone-aware) have
 * both been found carrying a stale/wrong currency, so neither is trusted.
 *
 * The optional second param is accepted only as a LAST-RESORT fallback for
 * the rare case countrySetting hasn't loaded yet — it never wins over a
 * loaded countrySetting. (Previously this project tried an
 * order-currency-is-historical design; that was reversed per explicit
 * confirmation that the current zone should always win instead.)
 *
 * redux-persist rehydrates countrySetting from localStorage in an effect (see
 * useIsHydrated's doc comment) — on a repeat visit the client has last
 * session's currency almost immediately while SSR always renders with none,
 * so a price string like "35" (server) vs "₹35" (client) mismatches and
 * trips a hydration error. Held off until the client is confirmed hydrated
 * so the first client render matches the server; the real symbol lands on
 * the second render, same pattern as t()'s own hydration guard.
 */
export interface CurrencyResult {
  currency: string;
  currencyCode: string;
  decimals: number;
}

interface FallbackCurrencySource {
  currency?: string | null;
  currency_code?: string | null;
  decimal_point?: number | string | null;
}

export default function useCurrency(
  lastResortFallback?: FallbackCurrencySource | null,
): CurrencyResult {
  const countrySetting = useSelector(
    (state: any) => state.CountrySetting?.countrySetting,
  );
  const globalSetting = useSelector((state: any) => state.Setting?.setting);
  const hydrated = useIsHydrated();

  if (!hydrated) {
    return { currency: "", currencyCode: "", decimals: 0 };
  }

  const currency =
    countrySetting?.currency ||
    globalSetting?.currency ||
    lastResortFallback?.currency ||
    "";
  const currencyCode =
    countrySetting?.currency_code ||
    globalSetting?.currency_code ||
    lastResortFallback?.currency_code ||
    "";
  const decimals = Number(
    countrySetting?.decimal_point ??
      globalSetting?.decimal_point ??
      lastResortFallback?.decimal_point ??
      0,
  );

  return { currency, currencyCode, decimals };
}
