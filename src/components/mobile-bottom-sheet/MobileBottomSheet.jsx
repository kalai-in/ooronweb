import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { t } from "@/utils/translation";
import { useRouter } from "next/router";
import { usePathname } from "next/navigation";
import useStandalone from "@/hooks/useStandalone";

const MobileBottomSheet = ({ isOpen = true }) => {
  const isStandalone = useStandalone();
  const [isVisible, setIsVisible] = useState(isOpen);
  const [hasClosedOnce, setHasClosedOnce] = useState(false);
  const [showAppNotInstalledPopup, setShowAppNotInstalledPopup] =
    useState(false);
  const settings = useSelector((state) => state.Setting.setting);
  const router = useRouter();

  const path = usePathname();

  const androidAppLink = settings?.web_settings?.android_app_url;
  const iosAppLink = settings?.web_settings?.ios_app_url;
  const appName = process.env.NEXT_PUBLIC_WEB_NAME || "eCommerce";

  const appScheme = process.env.NEXT_PUBLIC_WEB_NAME || "eCommerce";

  const [isAndroid, setIsAndroid] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isMobileWidth, setIsMobileWidth] = useState(false);

  const currentStoreLink = isAndroid
    ? androidAppLink
    : isIOS
      ? iosAppLink
      : androidAppLink;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const userAgent =
      navigator.userAgent || navigator.vendor || window.opera || "";
    // Intentional sync setState: derives state from the external userAgent/window APIs on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsAndroid(/android/i.test(userAgent));
    setIsIOS(/iPad|iPhone|iPod/.test(userAgent) && !window.MSStream);

    const updateWidth = () => setIsMobileWidth(window.innerWidth < 769);
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  useEffect(() => {
    // Intentional sync setState: mirrors the isOpen prop into local visibility state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsVisible(isOpen);
  }, [isOpen]);

  useEffect(() => {
    const hasClosedSheet = sessionStorage.getItem("hasClosedBottomSheet");
    if (hasClosedSheet) {
      // Intentional sync setState: seeds visibility from sessionStorage on mount.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsVisible(false);
    }

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        if (Date.now() - window.lastDeepLinkAttempt < 1000) {
          setShowAppNotInstalledPopup(false);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setHasClosedOnce(true);

    sessionStorage.setItem("hasClosedBottomSheet", "true");
  };

  const handleOpenApp = () => {
    // Build a valid URI scheme from the app name:
    // lowercase, drop everything except letters/digits (spaces, punctuation,
    // "&", etc. are illegal in a scheme). Fall back to "app" if nothing is left.
    const sanitizedAppName =
      appScheme
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "") || "app";

    const currentPath = path;

    const hostname =
      typeof window !== "undefined" ? window.location.hostname : "";

    let deepLink = `${sanitizedAppName}://${hostname}${currentPath}`;

    window.lastDeepLinkAttempt = Date.now();

    const start = Date.now();

    const appCheckTimeout = setTimeout(() => {
      if (!document.hidden) {
        console.error("App not installed, showing popup");
        setShowAppNotInstalledPopup(true);
      }
    }, 2000);

    if (isIOS) {
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = deepLink;
      document.body.appendChild(iframe);

      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 100);
    }

    if (isAndroid) {
      window.onerror = function (message) {
        if (
          message.includes("Failed to launch") &&
          message.includes("intent://")
        ) {
          clearTimeout(appCheckTimeout);

          setShowAppNotInstalledPopup(true);

          window.onerror = null;
          return true;
        }
      };
    }

    try {
      // Not an internal Next.js route: deepLink is a custom app URI scheme
      // (e.g. "appname://...") used to hand off to the native app.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.href = deepLink;
    } catch (e) {
      console.error("Error opening app:", e);
      clearTimeout(appCheckTimeout);

      setShowAppNotInstalledPopup(true);
    }
  };

  const handleDownloadApp = () => {
    setShowAppNotInstalledPopup(false);

    if (currentStoreLink) {
      window.location.href = currentStoreLink;
    } else {
      if (isAndroid) {
        window.location.href = `https://play.google.com/store/search?q=${appName}&c=apps`;
      } else if (isIOS) {
        window.location.href = `https://apps.apple.com/search?term=${appName}`;
      }
    }
  };

  if (!isMobileWidth) {
    return null;
  }
  // Already running as an installed app. "Open in app" would fire the
  // appname:// scheme at the very app the user is already inside, and its
  // 2-second no-response timeout would then show the "App not installed" popup —
  // so this sheet actively misfired in a PWA rather than merely being redundant.
  if (isStandalone) {
    return null;
  }

  return (
    <>
      <Sheet open={isVisible} onOpenChange={setIsVisible}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl border-t-0 p-0 h-auto max-h-[80vh] overflow-hidden"
        >
          <div className="p-6">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 primaryBg rounded-xl flex items-center justify-center mr-4 flex-shrink-0">
                <span className=" text-2xl font-bold">
                  {appName?.charAt(0)?.toUpperCase()}
                </span>
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-bold secondryTextColor mb-1">
                  {appName}
                </h4>
                <p className="text-sm leadColor">
                  {t("betterExperienceInApp")}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                className="flex-1 primaryBackColor text-white rounded-lg py-3 px-4 font-semibold text-base transition-opacity hover:opacity-90"
                onClick={handleOpenApp}
              >
                {t("openInApp")}
              </button>
              <button
                className="flex-1 text-white footer rounded-lg py-3 px-4 font-semibold text-base transition-colors hover:bg-gray-200"
                onClick={handleClose}
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {showAppNotInstalledPopup && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowAppNotInstalledPopup(false)}
          />

          <div className="relative footer rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold secondryTextColor mb-3">
              {t("appNotInstalled", { appName: appName })}
            </h3>
            <p className="text-sm text-white mb-6">
              {isAndroid
                ? t("downloadPromptPlayStore")
                : t("downloadPromptAppStore")}
            </p>

            <div className="flex gap-3">
              <button
                className="flex-1 primaryBackColor text-white rounded-lg py-3 px-4 font-semibold text-base transition-opacity hover:opacity-90"
                onClick={handleDownloadApp}
              >
                {isAndroid ? t("playStore") : t("appStore")}
              </button>
              <button
                className="flex-1 text-white bg-black rounded-lg py-3 px-4 font-semibold text-base transition-colors hover:bg-gray-200"
                onClick={() => setShowAppNotInstalledPopup(false)}
              >
                {t("cancel")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MobileBottomSheet;
