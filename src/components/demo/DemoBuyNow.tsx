"use client";
import React from "react";
import { useSelector } from "react-redux";
import { t } from "@/utils/translation";
import useIsHydrated from "@/hooks/useIsHydrated";
import useStandalone from "@/hooks/useStandalone";

// Where the badge sends buyers. This is the TEMPLATE VENDOR's own listing, not a
// client's storefront — the badge only ever renders on a demo deployment, so a
// default here is safe. Still overridable per-deployment via the env var, and it
// never appears on a real client site because demo_mode gates it.
const DEFAULT_BUY_URL =
  "https://www.marketplace.wrteam.in/products/snapbuy-hyperlocal-quick-commerce-ecommerce-platform";

/**
 * "Buy Now" badge shown only on demo deployments.
 *
 * `demo_mode` comes from the settings API ("0" | "1"), not a build-time env var,
 * so it can be flipped server-side without a redeploy — same source the demo
 * login autofill already reads.
 */
const DemoBuyNow = () => {
  const setting = useSelector((state: any) => state.Setting.setting);
  // `setting` is persisted, so it is empty during SSR and on the first client
  // paint. Rendering off it before hydration would flip the badge in/out and
  // discard the tree; wait until the store has rehydrated.
  const isHydrated = useIsHydrated();
  // Installed as an app → the visitor is USING the demo, not evaluating whether
  // to buy the template, and the marketplace link would eject them out of the
  // standalone window.
  const isStandalone = useStandalone();

  if (!isHydrated) return null;
  if (isStandalone) return null;
  // Loose == : the API sends the flag as the string "1", but a numeric 1 is just
  // as valid a shape for it.
  if (setting?.demo_mode != 1) return null;

  const href = process.env.NEXT_PUBLIC_BUY_NOW_URL || DEFAULT_BUY_URL;

  return (
    <a
      href={href}
      target="_blank"
      // noreferrer alongside noopener: the target is a third-party marketplace,
      // so don't leak the referring demo URL either.
      rel="noopener noreferrer"
      // BackToTop and the support launcher stack on the right; this sits on
      // the LEFT, so it doesn't share their column and doesn't need to stack
      // above them. Uses their row-1 offset (clears the fixed bottom nav on
      // mobile) instead of a higher row — stacking this at row 3 left a big
      // empty gap underneath since nothing else occupies the left side.
      //
      // Collapsed to a plain circle at rest (matches BackToTop/support FAB
      // sizing) and expands into a labelled pill on hover/focus — `group` +
      // width transition on the label span, not on the `<a>` itself, so the
      // circle stays perfectly round while collapsed instead of the whole
      // pill resizing awkwardly.
      className="demo-buy-now-pulse primaryBackColor group fixed start-4 md:start-6 bottom-[calc(72px+env(safe-area-inset-bottom))] md:bottom-6 z-40 flex h-12 items-center overflow-hidden rounded-full px-3.5 text-sm font-bold text-white shadow-lg transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-xl active:scale-95"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4 shrink-0"
        aria-hidden="true"
      >
        <circle cx="8" cy="21" r="1" />
        <circle cx="19" cy="21" r="1" />
        <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
      </svg>
      <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-300 ease-out group-hover:max-w-[100px] group-hover:opacity-100 group-hover:ms-2 group-focus-visible:max-w-[100px] group-focus-visible:opacity-100 group-focus-visible:ms-2">
        {t("buy_now")}
      </span>
    </a>
  );
};

export default DemoBuyNow;
