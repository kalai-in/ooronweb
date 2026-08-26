import React, { useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useSelector } from 'react-redux';
import { useTheme } from 'next-themes';
import loaderAnimation from '../../assets/shopping.json';

const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

// The accent shapes in shopping.json (cart lines + a shopping bag) are baked
// in two yellow tones: a main yellow (rgb 255,200,46) on the lines + bag, and a
// darker yellow (rgb 235,174,20) used as that bag's shade. We recolor BOTH to
// the runtime primary color so the loader follows the settings-API theme. The
// shade tone is darkened slightly so the bag keeps its depth instead of going
// flat. The cart body / wheels (black + grays) are structural and left as-is.
const ACCENT_TONES = [
  [1, 0.784313785329, 0.180392156863], // main yellow → primary
  [0.921568627451, 0.682352941176, 0.078431372549], // shade yellow → darkened primary
];

// Multiply each channel to darken (0–1). The shade tone gets this applied.
const SHADE_FACTOR = 0.82;

const hexToLottieRgb = (hex) => {
  if (!hex) return null;
  let h = hex.trim().replace(/^#/, '');
  // Expand 3-char shorthand (#abc → #aabbcc).
  if (/^[a-f\d]{3}$/i.test(h)) {
    h = h.split('').map((c) => c + c).join('');
  }
  const m = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
  if (!m) return null;
  return [1, 2, 3].map((i) => parseInt(m[i], 16) / 255);
};

const near = (a, b) => Math.abs(a - b) < 0.02;

// Returns a deep clone of the animation with both yellow accent tones swapped to
// `rgb` (the shade tone darkened so the bag keeps its depth).
const recolorAccent = (anim, rgb) => {
  if (!rgb) return anim;
  const clone = JSON.parse(JSON.stringify(anim));
  const shade = rgb.map((c) => c * SHADE_FACTOR);

  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== 'object') return;
    if (
      node.ty === 'fl' || node.ty === 'st' // fill / stroke
    ) {
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
 * Loader.
 *  - screen="full": full-screen Lottie animation overlay.
 *  - otherwise: small primary-color ring spinner for inline/section use.
 *
 * @param {string} [background] Inline background for the non-fullscreen wrapper.
 * @param {string} [height]     Wrapper height (inline mode).
 * @param {string} [width]      Wrapper width (inline mode).
 * @param {string} [screen]     "full" renders the full-screen Lottie loader.
 * @param {number} [size=36]    Inline spinner diameter in px.
 */

const Loader = ({ background, height, width, screen, size }) => {
  // Primary color from the settings API (reactive — recolors as soon as the
  // settings load, not just at first mount). The full-screen loader can mount
  // before settings arrive (e.g. the _app.js boot loader), so reading a one-shot
  // CSS var would catch the build-time default. Read redux instead and fall back
  // to the CSS var only when settings aren't in yet.
  const webSettings = useSelector(
    (state) => state.Setting?.setting?.web_settings,
  );
  const { resolvedTheme } = useTheme();
  const primaryColor = useMemo(() => {
    const isDark = resolvedTheme === 'dark';
    const fromSettings = isDark
      ? webSettings?.dark_mode_color || webSettings?.color
      : webSettings?.light_mode_color || webSettings?.color;
    if (fromSettings) return fromSettings;
    if (typeof window === 'undefined') return null;
    return getComputedStyle(document.documentElement)
      .getPropertyValue('--primary-color');
  }, [webSettings, resolvedTheme]);

  const animationData = useMemo(() => {
    if (screen !== 'full') return loaderAnimation;
    return recolorAccent(loaderAnimation, hexToLottieRgb(primaryColor));
  }, [screen, primaryColor]);

  if (screen === 'full') {
    return (
      <div className="fixed inset-0 z-[999] flex items-center justify-center bg-white">
        <Lottie
          animationData={animationData}
          loop
          autoplay
          className="h-48 w-48"
        />
      </div>
    );
  }

  const dim = size || 36;
  return (
    <div
      className="flex items-center justify-center"
      style={{
        width,
        height,
        background: background || 'transparent',
      }}
    >
      <span
        className="loaderRing inline-block"
        style={{ width: dim, height: dim }}
        role="status"
        aria-label="Loading"
      />
    </div>
  );
};

export default Loader;
