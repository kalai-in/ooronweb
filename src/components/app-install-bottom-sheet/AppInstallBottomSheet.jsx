import { useCallback, useEffect, useRef, useState } from "react";
import useStandalone from "@/hooks/useStandalone";
import { useSelector } from "react-redux";
import Image from "next/image";
import Link from "next/link";

/**
 * AppInstallBottomSheet
 *
 * Mobile-only "install our app" bottom sheet (Blinkit/Zepto/Swiggy style).
 *
 * Behaviour:
 *  - Renders only on mobile devices (Android / iOS user-agents).
 *  - Never renders on desktop / tablet.
 *  - Never renders when the site is already running as an installed app
 *    (PWA standalone display-mode or iOS navigator.standalone).
 *  - Shows once per session (sessionStorage guard).
 *  - Stays dismissed for 7 days after the user closes / continues on website
 *    (localStorage timestamp).
 *  - No backend / API dependency.
 *
 * Trigger: opens after a 6s timer OR on the first meaningful interaction
 * (scroll / click / touch / keydown), whichever comes first.
 */

const LS_DISMISSED = "app_install_prompt_dismissed"; // "1" once dismissed
const LS_LAST_SHOWN = "app_install_prompt_last_shown"; // dismissal timestamp (ms)
const SS_SHOWN_THIS_SESSION = "app_install_prompt_session_shown"; // "1" per tab session

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const SHOW_DELAY_MS = 6000; // 6s, within the requested 5-10s window

const isBrowser = () => typeof window !== "undefined";

const getUserAgent = () => {
  if (!isBrowser()) return "";
  return navigator.userAgent || navigator.vendor || window.opera || "";
};

const isAndroidUA = (ua) => /android/i.test(ua);
const isIOSUA = (ua) =>
  /iPad|iPhone|iPod/.test(ua) && !(isBrowser() && window.MSStream);

// Treat as mobile only for phone-class Android/iOS user-agents.
// iPadOS reports as "Macintosh" + touch; we intentionally exclude tablets,
// so we do NOT special-case that here.
const isMobileDevice = (ua) => isAndroidUA(ua) || isIOSUA(ua);

// App-already-installed detection lives in useStandalone(): the same two checks
// (display-mode media query + iOS navigator.standalone), but SSR-safe and
// re-evaluated when the display mode changes mid-session — a desktop install
// switches the window over without a reload, which the old render-time read
// could not see.

const isDismissedWithin7Days = () => {
  if (!isBrowser()) return false;
  try {
    if (localStorage.getItem(LS_DISMISSED) !== "1") return false;
    const last = Number.parseInt(
      localStorage.getItem(LS_LAST_SHOWN) || "0",
      10,
    );
    if (!last) return false;
    return Date.now() - last < SEVEN_DAYS_MS;
  } catch {
    return false;
  }
};

const shownThisSession = () => {
  if (!isBrowser()) return false;
  try {
    return sessionStorage.getItem(SS_SHOWN_THIS_SESSION) === "1";
  } catch {
    return false;
  }
};

const AppInstallBottomSheet = () => {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  // Already running as an installed app → never prompt to install it again.
  const isStandalone = useStandalone();

  const settings = useSelector((state) => state.Setting.setting);
  // The location modal is a mandatory blocking dialog until a city is chosen.
  // Don't let this sheet stack over it (its z-[9999] backdrop would swallow the
  // modal's clicks). Only eligible once a delivery location exists.
  const hasCity = useSelector((state) => state.City.city != null);

  const triggeredRef = useRef(false);
  const timerRef = useRef(null);

  const ua = getUserAgent();
  const isIOS = isIOSUA(ua);

  const web = settings?.web_settings;
  const appName =
    web?.web_name || process.env.NEXT_PUBLIC_WEB_NAME || "eCommerce";
  const webLogo = web?.web_logo;
  // Store URLs come from web_settings.android_app_url / ios_app_url.
  const androidAppLink = web?.android_app_url;
  const iosAppLink = web?.ios_app_url;
  // Platform-matched store URL. Trimmed to a non-empty string or undefined —
  // the API sends "" (not null) for an unconfigured store, and a blank href
  // would otherwise read as "configured".
  const rawStoreLink = isIOS ? iosAppLink : androidAppLink;
  const storeLink =
    typeof rawStoreLink === "string" && rawStoreLink.trim()
      ? rawStoreLink.trim()
      : undefined;

  // Whether this device/session is eligible to ever show the sheet.
  // `storeLink` is required: with no store URL configured for THIS platform the
  // primary action would fall back to href="#" and open a blank tab, so the sheet
  // would cost the user a dismissal and give nothing back. Better to stay hidden.
  const eligible =
    isMobileDevice(ua) &&
    !!storeLink &&
    !isStandalone &&
    !isDismissedWithin7Days() &&
    !shownThisSession() &&
    hasCity;

  const open = useCallback(() => {
    if (triggeredRef.current || !eligible) return;
    triggeredRef.current = true;
    try {
      sessionStorage.setItem(SS_SHOWN_THIS_SESSION, "1");
    } catch {
      /* storage may be unavailable (private mode) – fall through */
    }
    setVisible(true);
  }, [eligible]);

  // Arm the time-based + interaction-based triggers.
  useEffect(() => {
    if (!eligible) return;

    timerRef.current = setTimeout(open, SHOW_DELAY_MS);

    const onInteract = () => open();
    const events = ["scroll", "click", "touchstart", "keydown"];
    events.forEach((e) =>
      window.addEventListener(e, onInteract, { once: true, passive: true }),
    );

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, onInteract));
    };
  }, [eligible, open]);

  // Persist the 7-day dismissal and animate out.
  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(LS_DISMISSED, "1");
      localStorage.setItem(LS_LAST_SHOWN, String(Date.now()));
    } catch {
      /* ignore storage errors */
    }
    setClosing(true);
    setTimeout(() => {
      setVisible(false);
      setClosing(false);
    }, 280);
  }, []);

  // Guard render: SSR-safe + eligibility. `visible` already gates everything,
  // but keep the early return so the component tree stays empty otherwise.
  if (!visible) return null;

  return (
    <div
      className="ai-sheet-root fixed inset-0 z-[9999] flex items-end justify-center md:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Install our app"
    >
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
          closing ? "opacity-0" : "opacity-100"
        }`}
        onClick={dismiss}
      />

      {/* Sheet */}
      <div
        className={`relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-t-[24px] shadow-[0_-6px_30px_rgba(0,0,0,0.2)] px-5 pt-3 pb-[calc(18px+env(safe-area-inset-bottom))] ${
          closing
            ? "animate-[aiSlideDown_0.28s_ease-in_forwards]"
            : "animate-[aiSlideUp_0.36s_cubic-bezier(0.16,1,0.3,1)_forwards]"
        }`}
      >
        {/* Drag handle */}
        <div className="flex justify-center pb-4">
          <span className="h-1.5 w-11 rounded-full bg-gray-300 dark:bg-neutral-600" />
        </div>

        {/* Logo + content */}
        <div className="mb-5">
          {webLogo ? (
            <Image
              src={webLogo}
              alt={appName}
              width={140}
              height={40}
              className="h-9 w-auto object-contain mb-2.5"
            />
          ) : (
            <h3 className="text-lg font-bold secondryTextColor mb-1">
              {appName}
            </h3>
          )}
          <p className="text-sm leadColor leading-relaxed">
            Get a better experience in our mobile app — faster checkout,
            app-only offers & live order tracking.
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2.5">
          <Link
            href={storeLink || "#"}
            target="_blank"
            rel="noopener noreferrer"
            onClick={dismiss}
            className="flex-1 text-center primaryBackColor text-white rounded-lg py-2.5 px-3 font-semibold text-sm whitespace-nowrap transition-opacity hover:opacity-90"
          >
            Get the App
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="flex-1 rounded-lg py-2.5 px-3 font-semibold text-sm whitespace-nowrap bg-gray-100 dark:bg-neutral-800 secondryTextColor transition-colors hover:bg-gray-200"
          >
            Continue on Website
          </button>
        </div>
      </div>

      {/* Scoped styles */}
      <style jsx>{`
        @keyframes aiSlideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        @keyframes aiSlideDown {
          from {
            transform: translateY(0);
          }
          to {
            transform: translateY(100%);
          }
        }
      `}</style>
    </div>
  );
};

export default AppInstallBottomSheet;
