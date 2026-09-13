import { useEffect, useState } from "react";
import {
  CONSENT_ACCEPTED,
  CONSENT_EVENT,
  CONSENT_KEY,
  readConsent,
} from "@/utils/cookieConsent";

/**
 * The visitor's cookie choice, kept live.
 *
 * Returns `null` during SSR and on the first client render — localStorage is
 * unreadable on the server, so anything gated on this renders absent-then-
 * present rather than mismatching (same contract as useIsHydrated).
 *
 * Re-renders when the choice changes:
 *  - `cookieconsentchange` — this tab (setItem doesn't fire `storage` locally)
 *  - `storage` — another tab, so accepting in one applies everywhere
 *
 */
interface CookieConsentResult {
  consent: string | null;
  accepted: boolean;
  answered: boolean;
}

const useCookieConsent = (): CookieConsentResult => {
  const [consent, setConsent] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR-unreadable localStorage; same hydration contract as useIsHydrated
    setConsent(readConsent());

    const sync = () => setConsent(readConsent());
    const onStorage = (e: StorageEvent) => {
      // Ignore unrelated keys; `key` is null when storage is cleared wholesale,
      // which does concern us.
      if (e.key === null || e.key === CONSENT_KEY) sync();
    };

    window.addEventListener(CONSENT_EVENT, sync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(CONSENT_EVENT, sync);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return {
    consent,
    accepted: consent === CONSENT_ACCEPTED,
    answered: consent !== null,
  };
};

export default useCookieConsent;
