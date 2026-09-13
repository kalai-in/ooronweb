"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { t } from "@/utils/translation";
import useStoreClosed from "@/hooks/useStoreClosed";
import useIsHydrated from "@/hooks/useIsHydrated";
import storeCloseAnimation from "@/assets/store-close.json";
import { getPrimaryLottieRgb, recolorAnimation } from "@/utils/lottieColor";
import ThemedSvg from "@/components/notfound/ThemedSvg";
import BagHeartSvg from "@/assets/bag-heart.svg";
import SparkleSvg from "@/assets/sparkle.svg";

// ssr:false — lottie-react touches the DOM on import; every other Lottie call
// site in the app loads it the same way.
const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

/**
 * Soft store-closed notice for the top of the home page.
 *
 * This is the `store_closed: 1` case from the home_layout API — distinct from
 * the `status: 0` response that replaces the whole page with <StoreClosed>.
 * Here the catalogue stays fully browsable and only the buy path is blocked, so
 * the state was otherwise only discoverable by clicking a greyed-out Add button
 * and reading the toast. This states it up front, before the user fills a cart
 * they can't check out.
 *
 * Renders nothing when the store is open, so callers can mount it
 * unconditionally.
 */
const StoreClosedBanner = () => {
  const { storeClosed } = useStoreClosed();
  // ShopMode is persisted: the server renders the slice default (false) and the
  // client may rehydrate true. A banner whose PRESENCE differs between the two
  // is a hydration mismatch, so it only appears on the second client render.
  const isHydrated = useIsHydrated();

  // The artwork's accent is a baked-in blue (#2C67AA / #388EF0 / #0277FA), not
  // black — hence "accent" mode, which repaints saturated colors and leaves the
  // near-black outlines and grey shading that carry the drawing's structure.
  //
  // Keyed on isHydrated, not []: getPrimaryLottieRgb reads a CSS var off
  // document and returns null on the server, where recolorAnimation is a no-op.
  // Recomputing once hydrated is what actually applies the tint.
  // isHydrated isn't read in the body but is the deliberate recompute trigger:
  // getPrimaryLottieRgb() returns null on the server, so this must re-run once
  // hydrated to apply the tint.
  const storeClosedLottie = useMemo(
    () =>
      recolorAnimation(storeCloseAnimation, getPrimaryLottieRgb(), "accent"),
    [isHydrated], // eslint-disable-line react-hooks/exhaustive-deps
  );

  if (!isHydrated || !storeClosed) return null;

  return (
    <div className="container pt-3">
      {/* max-w caps the notice: at full container width the copy and the end
          artwork were pushed to opposite edges with a dead void between them.

          Deliberately compact — this sits above the whole catalogue, so it has
          to state its message without pushing the products below the fold. The
          art is sized to the copy rather than the copy being centred in whatever
          height the art wants. */}
      <div
        role="status"
        className="relative mx-auto max-w-4xl overflow-hidden rounded-2xl border"
        style={{
          borderColor:
            "color-mix(in srgb, var(--primary-color) 10%, transparent)",
          backgroundImage:
            "linear-gradient(110deg, color-mix(in srgb, var(--primary-color) 4%, var(--category-card-bg)), color-mix(in srgb, var(--primary-color) 1.5%, var(--category-card-bg)) 55%, var(--category-card-bg))",
          // Two-layer shadow: a tight contact shadow plus a wide brand-tinted
          // glow. Flat `shadow-sm` sat on the page; this lifts off it.
          boxShadow:
            "0 1px 2px color-mix(in srgb, var(--primary-color) 5%, transparent), 0 8px 24px -14px color-mix(in srgb, var(--primary-color) 14%, transparent)",
        }}
      >
        {/* Soft corner blobs, top-end and bottom-start. Decorative, so they
            never reach a screen reader or intercept a click.

            z-0 against the content row's z-10: these are blurred and large
            enough that the top-end one overlaps the bag artwork. Without an
            explicit order the later sibling won and the blob washed out the
            bag. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -end-16 -top-20 z-0 h-36 w-36 rounded-full blur-2xl"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--primary-color) 8%, transparent)",
          }}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-16 -start-12 z-0 h-40 w-40 rounded-full blur-2xl"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--primary-color) 8%, transparent)",
          }}
        />

        {/* Base px-4/py-3 matters as much as the sm: values — without a
            mobile padding the copy ran flush to both card edges and clipped.
            The wider pe at sm+ is for the sparkle, which sits at a negative
            offset off the bag's corner and would otherwise meet
            overflow-hidden. */}
        <div className="relative z-10 flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-5 sm:py-2.5 sm:pe-9">
          {/* Hidden below sm: at phone widths the art would squeeze the copy
              into a two-word column. */}
          <span
            aria-hidden="true"
            className="hidden shrink-0 items-center justify-center sm:flex"
          >
            <Lottie
              animationData={storeClosedLottie}
              loop
              className="h-16 w-16 lg:h-[72px] lg:w-[72px]"
            />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-extrabold leading-tight tracking-tight sm:text-base primaryColor">
              {t("store_temporarily_closed")}
            </p>
            {/* The full stop is appended here, not in en.json: t() resolves
                against the server's json_data at runtime, so a period added to
                the local file never reaches the rendered string and the two
                sentences ran together. */}
            <p className="mt-0.5 text-xs leading-snug SecondaryTextColor">
              {`${t("store_closed_message")}`.replace(/[.!?]?$/, ".")}{" "}
              {t("thanks_for_your_love_and_support")}
            </p>
          </div>

          {/* Bag + sparkle on the end edge. Both go through ThemedSvg so their
              baked blues follow --primary-color. */}
          <span
            aria-hidden="true"
            className="pointer-events-none relative z-10 hidden shrink-0 items-center sm:flex"
          >
            <span className="relative block">
              <ThemedSvg
                src={BagHeartSvg}
                className="h-11 w-11 drop-shadow-sm sm:h-[56px] sm:w-[56px]"
              />
              <ThemedSvg
                src={SparkleSvg}
                className="absolute -end-2 -top-1.5 h-5 w-5 sm:-end-3 sm:h-6 sm:w-6"
              />
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default StoreClosedBanner;
