"use client";
import { useEffect, useState } from "react";
import { t } from "@/utils/translation";
import NoInternetImage from "@/assets/empty-state/no-internet-connection.svg";
import ThemedSvg from "@/components/notfound/ThemedSvg";

// Full-screen overlay shown when the browser goes offline. Listens to the
// window online/offline events (and seeds from navigator.onLine on mount).
// Mounted once globally in Layout so it covers every route.
const OfflineOverlay = () => {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    // Seed from the current status (navigator.onLine is only reliable client-side).
    // Intentional sync setState: mirrors an external browser API on mount.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOffline(true);
    }
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center gap-5 bg-white/95 dark:bg-zinc-950/95 px-6 text-center backdrop-blur-sm">
      <ThemedSvg
        src={NoInternetImage}
        alt={t("no_internet_connection") || "No internet connection"}
        className="w-3/4 max-w-[320px]"
      />
      <div className="flex flex-col gap-1.5">
        <h2 className="text-xl md:text-2xl font-bold textColor">
          {t("no_internet_connection") || "No Internet Connection"}
        </h2>
        <p className="text-sm SecondaryTextColor max-w-sm">
          {t("check_your_connection") ||
            "Please check your network and try again."}
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          if (typeof navigator !== "undefined" && navigator.onLine) {
            setOffline(false);
          } else {
            window.location.reload();
          }
        }}
        className="primaryBackColor text-white rounded-xl px-6 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
      >
        {t("retry") || "Retry"}
      </button>
    </div>
  );
};

export default OfflineOverlay;
