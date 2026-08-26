import React, { useMemo } from "react";
import dynamic from "next/dynamic";
import { useSelector } from "react-redux";
import { useTheme } from "next-themes";
import { t } from "@/utils/translation";
import shopCloseAnimation from "@/assets/shop-close.json";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

// The accent fills in shop-close.json are baked in one blue tone (rgb 48,155,252).
// Recolor that tone to the runtime primary so the illustration follows the
// settings-API theme. Dark strokes + white fills are structural, left as-is.
const ACCENT_TONES = [[0.187999994615, 0.607999973671, 0.987999949736]];
const SHADE_FACTOR = 0.82;

const hexToLottieRgb = (hex) => {
  if (!hex) return null;
  let h = hex.trim().replace(/^#/, "");
  if (/^[a-f\d]{3}$/i.test(h)) h = h.split("").map((c) => c + c).join("");
  const m = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
  if (!m) return null;
  return [1, 2, 3].map((i) => parseInt(m[i], 16) / 255);
};

const near = (a, b) => Math.abs(a - b) < 0.02;

const recolorAccent = (anim, rgb) => {
  if (!rgb) return anim;
  const clone = JSON.parse(JSON.stringify(anim));
  const shade = rgb.map((c) => c * SHADE_FACTOR);
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    if (node.ty === "fl" || node.ty === "st") {
      const k = node.c?.k;
      if (Array.isArray(k)) {
        const toneIdx = ACCENT_TONES.findIndex((tone) =>
          tone.every((c, i) => near(k[i], c)),
        );
        if (toneIdx !== -1) {
          const target = toneIdx === 0 ? rgb : shade;
          node.c.k = [...target, k[3] ?? 1];
        }
      }
    }
    Object.values(node).forEach(walk);
  };
  walk(clone.layers || []);
  return clone;
};

/**
 * Store-closed / "temporarily closed" screen. A shop-close Lottie (recolored to
 * the runtime primary) headlines a friendly message, framed by faint leaf/blob
 * decorations. All accent = `--primary-color` (settings API + theme, white-label
 * safe). No webfonts (CSP-safe). Respects `prefers-reduced-motion`.
 */
const StoreClosed = () => {
  const webSettings = useSelector(
    (state) => state.Setting?.setting?.web_settings,
  );
  const { resolvedTheme } = useTheme();
  const primaryColor = useMemo(() => {
    const isDark = resolvedTheme === "dark";
    const fromSettings = isDark
      ? webSettings?.dark_mode_color || webSettings?.color
      : webSettings?.light_mode_color || webSettings?.color;
    if (fromSettings) return fromSettings;
    if (typeof window === "undefined") return null;
    return getComputedStyle(document.documentElement).getPropertyValue(
      "--primary-color",
    );
  }, [webSettings, resolvedTheme]);

  const animationData = useMemo(
    () => recolorAccent(shopCloseAnimation, hexToLottieRgb(primaryColor)),
    [primaryColor],
  );

  return (
    <div className="sc-wrap relative flex min-h-[80vh] w-full items-center justify-center overflow-hidden p-6">
      <div className="sc-rise relative flex w-full max-w-[460px] flex-col items-center text-center">
        {/* shop-close Lottie in a tinted disc with a gentle float */}
        <span className="sc-disc primaryLightBack">
          <Lottie
            animationData={animationData}
            loop
            autoplay
            className="h-full w-full"
          />
        </span>

        <h1 className="sc-title textColor">
          {t("store_temporarily_closed") || "Store is Temporarily Closed"}
        </h1>

        <div className="sc-divider" aria-hidden="true">
          <span className="sc-line" />
        </div>

        <p className="sc-sub SecondaryTextColor">
          {t("store_closed_message") ||
            "We're taking a short break and will be back soon"}
        </p>
      </div>

      <style jsx>{`
        .sc-rise {
          animation: scRise 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) both;
        }
        @keyframes scRise {
          from {
            opacity: 0;
            transform: translateY(18px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        /* Disc — single soft tinted circle, gentle float. */
        .sc-disc {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: clamp(140px, 28vw, 180px);
          height: clamp(140px, 28vw, 180px);
          border-radius: 9999px;
          padding: clamp(16px, 3.5vw, 24px);
          margin-bottom: 26px;
          box-shadow:
            0 0 0 1px color-mix(in srgb, var(--primary-color) 12%, transparent),
            0 18px 36px -18px
              color-mix(in srgb, var(--primary-color) 40%, transparent);
          animation: scFloat 4.5s ease-in-out infinite;
        }
        @keyframes scFloat {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }
        .sc-title {
          font-weight: 800;
          font-size: clamp(24px, 5vw, 38px);
          line-height: 1.12;
          letter-spacing: -0.02em;
          text-wrap: balance;
        }
        /* Gradient accent divider. */
        .sc-divider {
          display: flex;
          justify-content: center;
          margin: 18px auto 20px;
          width: clamp(200px, 60%, 320px);
        }
        .sc-line {
          height: 3px;
          width: 100%;
          border-radius: 9999px;
          background: linear-gradient(
            90deg,
            transparent,
            var(--primary-color),
            transparent
          );
        }
        .sc-sub {
          font-size: clamp(14px, 2.3vw, 16px);
          line-height: 1.8;
          max-width: 400px;
          margin: 0 auto;
        }
        @media (prefers-reduced-motion: reduce) {
          .sc-rise,
          .sc-disc {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
};

export default StoreClosed;
