import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { t } from "@/utils/translation";
import {
  CONSENT_ACCEPTED,
  CONSENT_DECLINED,
  readConsent,
  writeConsent,
} from "@/utils/cookieConsent";

/**
 * CookieConsent
 *
 * Bottom banner driven entirely by the settings API's `web_settings`:
 *   cookie_consent_enabled     "1" to show the banner at all
 *   cookie_consent_title       heading (admin-authored, already localized)
 *   cookie_consent_description body copy
 *
 * Title and description come from the API, so they are rendered as-is rather
 * than through t() — only the buttons use translation keys.
 *
 * The choice is persisted via utils/cookieConsent, which also notifies the
 * analytics gate in _app.js — so declining stops GA/Clarity from loading in the
 * same page view, and accepting starts them without a reload.
 */
const CookieConsent = () => {
  const setting = useSelector((state: any) => state.Setting);
  const web = setting?.setting?.web_settings;

  const enabled = String(web?.cookie_consent_enabled ?? "") === "1";
  const title = web?.cookie_consent_title;
  const description = web?.cookie_consent_description;

  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  // Mount-gated: `setting` comes from redux-persist, which rehydrates after the
  // first paint, and localStorage is unreadable on the server. Deciding
  // visibility during SSR would render a banner the client then removes —
  // a hydration mismatch. See t-hydration-hazard / useIsHydrated.
  useEffect(() => {
    if (!enabled) {
      // intentional: hydration-gated visibility sync from redux-persist +
      // localStorage, neither readable during SSR — see doc comment above.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(false);
      return;
    }
    // Already answered → stay hidden. readConsent() returns null when storage
    // is blocked, which correctly shows the banner again.
    if (readConsent()) return;
    setVisible(true);
  }, [enabled]);

  const respond = useCallback(
    (answer: typeof CONSENT_ACCEPTED | typeof CONSENT_DECLINED) => {
      // Writes the value AND fires the in-tab event the analytics gate listens
      // for, so scripts start/stop immediately rather than on the next reload.
      writeConsent(answer);
      setClosing(true);
      setTimeout(() => {
        setVisible(false);
        setClosing(false);
      }, 250);
    },
    [],
  );

  // An enabled banner with no description is a half-configured setting — show
  // nothing rather than an empty card.
  if (!visible || !enabled || !description) return null;

  return (
    <div
      // Full-width bar pinned to the bottom edge, not a floating card. A card
      // sat ON TOP of the product grid and collided with the other bottom-
      // anchored UI (support launcher end-side, MaintenanceNotice, the mobile
      // bottom sheet). A bar spans the viewport, so nothing can sit beside it
      // and there is no overlap to negotiate.
      //
      // z-[9997]: one below MaintenanceNotice/support so a maintenance warning
      // — which is time-critical — is never covered by the consent bar.
      //
      // Below md the mobile bottom nav (Header.jsx, fixed bottom-0, ~60px +
      // safe-area) owns the bottom edge, so the bar rides above it rather than
      // burying the site's primary navigation. From md up that nav is hidden
      // and the bar takes the edge itself.
      // Fades as well as slides: on mobile the bar sits above the nav, so
      // translate-y-full alone leaves it visible over the nav mid-exit.
      className={`fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-[9997] transition-all duration-300 md:bottom-0 ${
        closing ? "translate-y-full opacity-0" : "translate-y-0 opacity-100"
      }`}
      role="dialog"
      aria-live="polite"
      aria-label={title || t("cookie_consent")}
    >
      <div
        className="border-t"
        style={{
          backgroundColor: "var(--bs-body-bg)",
          borderColor: "var(--border-color)",
          boxShadow: "0 -12px 32px -20px rgba(15, 23, 42, 0.35)",
        }}
      >
        {/* Same `container` as the rest of the site so the copy lines up with
            the page gutters instead of running edge-to-edge on desktop. */}
        <div className="container flex flex-col gap-3 py-3.5 text-start sm:flex-row sm:items-center sm:gap-5 sm:py-4">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
              style={{
                backgroundColor:
                  "color-mix(in srgb, var(--primary-color) 12%, transparent)",
                color: "var(--primary-color)",
              }}
              aria-hidden="true"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
              >
                <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5Z" />
                <circle cx="8.5" cy="12.5" r="0.6" fill="currentColor" />
                <circle cx="12.5" cy="9" r="0.6" fill="currentColor" />
                <circle cx="13" cy="15" r="0.6" fill="currentColor" />
              </svg>
            </span>

            <div className="min-w-0">
              <p className="text-sm font-semibold fontColor">
                {title || t("cookie_consent")}
              </p>
              <p className="mt-0.5 text-xs SecondaryTextColor sm:text-[13px]">
                {description}
              </p>
            </div>
          </div>

          {/* Equal visual weight, Decline first: a filled Accept next to a
              barely-there Decline nudges the choice, which is exactly what
              consent UI must not do. Both are outlined, same size, same
              hit area. */}
          <div className="flex shrink-0 items-center gap-2 ps-11 sm:ps-0">
            <button
              type="button"
              onClick={() => respond(CONSENT_DECLINED)}
              className="rounded-lg border px-4 py-2 text-xs font-semibold fontColor transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800 sm:text-[13px]"
              style={{ borderColor: "var(--border-color)" }}
            >
              {t("decline")}
            </button>
            <button
              type="button"
              onClick={() => respond(CONSENT_ACCEPTED)}
              className="rounded-lg border px-4 py-2 text-xs font-semibold transition-colors sm:text-[13px]"
              style={{
                borderColor: "var(--primary-color)",
                color: "var(--primary-color)",
              }}
            >
              {t("accept")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
