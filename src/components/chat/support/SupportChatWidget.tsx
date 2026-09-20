"use client";

import { useState } from "react";
import { useSelector } from "react-redux";
import { LuX } from "react-icons/lu";
import { BiSupport } from "react-icons/bi";

import { cn } from "@/lib/utils";
import { t } from "@/utils/translation";
import useIsRtl from "@/hooks/useIsRtl";
import SupportChat from "./SupportChat";

/**
 * Global floating support launcher (Myntra-style). A brand-colored bubble pinned
 * to the bottom corner on EVERY page; tapping it slides the always-on support
 * chat over from the side. Only shown to logged-in users (support needs an
 * account). Mounted once in the app Layout.
 */
export default function SupportChatWidget() {
  const [open, setOpen] = useState(false);
  const rtl = useIsRtl();
  const userId = useSelector((s: any) => s.User?.user?.id);

  // Support is account-scoped — hide the launcher for guests.
  if (!userId) return null;

  // Slide-over's off-screen position: RTL exits left, LTR exits right.
  const hiddenTranslateClass = rtl ? "-translate-x-full" : "translate-x-full";

  return (
    <>
      {/* Floating bubble — premium animated launcher */}
      {!open && (
        <div
          // Sits ABOVE the BackToTop button (z-40) but BELOW any chat slide-over
          // (z-50) — so an open chat drawer fully covers this launcher.
          className={cn(
            "sc-launcher group fixed z-[45]",
            // Row 2 of the bottom-right FAB stack. Rows are spaced by the
            // tallest control (48px) + a 12px gap so BackToTop (row 1),
            // this launcher (row 2) and DemoBuyNow (row 3) never overlap:
            //   mobile  72 / 132 / 192   (72 clears the fixed bottom nav)
            //   md+     24 /  84 / 144
            "bottom-[calc(132px+env(safe-area-inset-bottom))] md:bottom-[84px]",
            rtl ? "left-4 md:left-6" : "right-4 md:right-6",
          )}
        >
          {/* hover tooltip */}
          <span
            className={cn(
              "pointer-events-none absolute top-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-lg transition-all duration-200 group-hover:opacity-100",
              rtl
                ? "left-full ml-3 -translate-x-2 group-hover:translate-x-0"
                : "right-full mr-3 translate-x-2 group-hover:translate-x-0",
            )}
          >
            {t("need_help") || "Need Help?"}
          </span>

          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label={t("support") || "Support"}
            className="sc-bob relative flex h-11 w-11 items-center justify-center rounded-full text-white shadow-[0_10px_30px_-6px_var(--primary-color)] transition-transform duration-200 hover:scale-110 active:scale-95"
            style={{
              background:
                "linear-gradient(135deg, var(--primary-color), color-mix(in srgb, var(--primary-color) 70%, #000))",
            }}
          >
            {/* expanding pulse rings */}
            <span className="sc-ring absolute inset-0 rounded-full primaryBackColor" />
            <span
              className="sc-ring absolute inset-0 rounded-full primaryBackColor"
              style={{ animationDelay: "1s" }}
            />
            {/* glossy shine */}
            <span className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
              <span className="sc-shine absolute -top-1/2 left-0 h-full w-1/3 rotate-12 bg-white/25 blur-md" />
            </span>

            <BiSupport size={22} className="relative z-10" />
          </button>

          <style jsx>{`
            .sc-bob {
              animation: scBob 3.5s ease-in-out infinite;
            }
            .sc-ring {
              animation: scRing 2.4s ease-out infinite;
              opacity: 0;
              z-index: 0;
            }
            .sc-shine {
              animation: scShine 4s ease-in-out infinite;
            }
            @keyframes scBob {
              0%,
              100% {
                transform: translateY(0);
              }
              50% {
                transform: translateY(-5px);
              }
            }
            @keyframes scRing {
              0% {
                transform: scale(1);
                opacity: 0.5;
              }
              100% {
                transform: scale(1.9);
                opacity: 0;
              }
            }
            @keyframes scShine {
              0%,
              70%,
              100% {
                transform: translateX(-150%) rotate(12deg);
              }
              85% {
                transform: translateX(400%) rotate(12deg);
              }
            }
            @media (prefers-reduced-motion: reduce) {
              .sc-bob,
              .sc-ring,
              .sc-shine {
                animation: none;
              }
            }
          `}</style>
        </div>
      )}

      {/* Slide-over */}
      <div
        className={cn(
          "fixed inset-0 z-[70] transition",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        <button
          type="button"
          aria-label={t("close") || "Close"}
          className={cn(
            "absolute inset-0 cursor-default bg-black/40 backdrop-blur-[1px] transition-opacity duration-300",
            open ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setOpen(false)}
        />
        <div
          className={cn(
            "absolute top-0 h-full w-full sm:w-[420px] bg-white dark:bg-zinc-900 shadow-2xl flex flex-col transition-transform duration-300 ease-out",
            rtl ? "left-0" : "right-0",
            open ? "translate-x-0" : hiddenTranslateClass,
          )}
        >
          {/* Close */}
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t("close") || "Close"}
            className={cn(
              "absolute top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30",
              rtl ? "left-3" : "right-3",
            )}
          >
            <LuX size={18} />
          </button>

          {/* The support chat fills the panel. It manages its own header +
              composer; render it only while open so its polling/socket work
              isn't running for a closed panel. */}
          {open && (
            <div className="flex h-full flex-col [&>div]:h-full [&>div]:rounded-none [&>div]:border-0 [&>div]:shadow-none">
              <SupportChat />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
