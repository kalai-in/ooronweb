import React, { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import MaitanceImage from "@/assets/empty-state/maintainance.svg";
import ThemedSvg from "@/components/notfound/ThemedSvg";
import { t } from "@/utils/translation";
import { parseUtc } from "@/utils/maintenanceWindow";

// `labelKey`, not a resolved string: this list is module-level, so translating
// here would freeze the labels at import time — before redux-persist rehydrates
// the chosen language. t() runs per render instead.
const UNITS = [
  { key: "days", labelKey: "countdown_days", ms: 86400000 },
  { key: "hours", labelKey: "countdown_hours", ms: 3600000 },
  { key: "minutes", labelKey: "countdown_minutes", ms: 60000 },
  { key: "seconds", labelKey: "countdown_seconds", ms: 1000 },
];

/**
 * Split a remaining duration into cells, dropping leading units that are still
 * zero — a ten-minute window should read "09 : 58", not "00 : 00 : 09 : 58"
 * where the two meaningful numbers are the ones the eye reaches last. Always
 * keeps at least minutes+seconds so the row never collapses to one number.
 */
const splitDuration = (remaining) => {
  let rest = Math.max(0, remaining);
  const all = UNITS.map(({ key, labelKey, ms }) => {
    const value = Math.floor(rest / ms);
    rest -= value * ms;
    return { key, labelKey, value };
  });
  const firstSignificant = all.findIndex((u) => u.value > 0);
  const start =
    firstSignificant === -1
      ? all.length - 2
      : Math.min(firstSignificant, all.length - 2);
  return all.slice(start);
};

/**
 * One oversized brand-coloured numeral with its unit spelled out beneath.
 *
 * `min-w-0 flex-1` matters: the letter-spaced label ("SECONDS") is wider than
 * its own numeral, so without it the labels — not the digits — set the row's
 * width and a four-cell countdown overflows the card, clipping the outermost
 * cells on both edges.
 */
const TimeCell = ({ labelKey, value }) => (
  <div className="flex min-w-0 flex-1 flex-col items-center gap-2 md:gap-3">
    <span
      className="text-[2rem] font-extrabold leading-none tabular-nums sm:text-4xl md:text-5xl lg:text-6xl"
      style={{ color: "var(--primary-color)" }}
    >
      {String(value).padStart(2, "0")}
    </span>
    <span className="w-full truncate text-center text-[9px] font-medium uppercase tracking-[0.18em] SecondaryTextColor sm:text-[10px] md:text-xs">
      {t(labelKey)}
    </span>
  </div>
);

// `shrink-0` so the colons keep their width while the cells absorb the squeeze.
const Separator = () => (
  <span
    className="shrink-0 select-none self-start text-2xl font-bold leading-none sm:text-3xl md:text-4xl lg:text-5xl"
    style={{
      color: "color-mix(in srgb, var(--primary-color) 35%, transparent)",
    }}
    aria-hidden="true"
  >
    :
  </span>
);

/**
 * Full-screen maintenance splash shown while `web_settings.website_mode == 1`.
 *
 * When an end time is supplied the page counts down to it and reloads itself at
 * zero, so visitors who sat on the page get back into the site without having
 * to refresh by hand. The reload re-fetches settings; if the backend is still
 * flagged as under maintenance, this screen simply renders again.
 *
 * @param {string} message - admin remark (`website_mode_remark`)
 * @param {string} [endAt] - `website_mode_end`, UTC datetime string
 */
const MaintanceMode = ({ message, endAt }) => {
  const setting = useSelector((state) => state.Setting);
  const logo = setting?.setting?.web_settings?.web_logo;

  const endTime = useMemo(() => parseUtc(endAt), [endAt]);

  // `null` until mounted: the server has no clock the client agrees with, so
  // rendering a duration during SSR guarantees a hydration mismatch on the very
  // first paint. Render the static shell first, fill the timer in on the client.
  const [remaining, setRemaining] = useState(null);

  useEffect(() => {
    if (!endTime) return;

    const tick = () => {
      const left = endTime - Date.now();
      if (left <= 0) {
        setRemaining(0);
        // Re-fetch settings; drops out of maintenance once the flag clears.
        window.location.reload();
        return true;
      }
      setRemaining(left);
      return false;
    };

    if (tick()) return;
    const id = setInterval(() => {
      if (tick()) clearInterval(id);
    }, 1000);
    return () => clearInterval(id);
  }, [endTime]);

  const showCountdown = Boolean(endTime) && remaining !== null && remaining > 0;
  const cells = showCountdown ? splitDuration(remaining) : null;

  return (
    <section
      className="relative flex min-h-screen w-full items-center justify-center overflow-hidden px-5 py-10"
      style={{
        // Faint centred wash behind the content so the white card reads as a
        // raised surface. A barely-there brand tint, never a saturated flood.
        backgroundColor:
          "color-mix(in srgb, var(--primary-color) 3%, var(--body-background-color))",
        backgroundImage:
          "radial-gradient(ellipse 80% 55% at 50% 42%, color-mix(in srgb, var(--primary-color) 7%, transparent) 0%, transparent 72%)",
      }}
    >
      {/* Everything lives inside one panel. Split across separate floating
          blocks, the small illustration reads as marooned in whitespace; a
          single bordered surface binds art, copy and timer into one object. */}
      <div
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-3xl md:max-w-2xl lg:max-w-3xl lg:rounded-[2rem]"
        style={{
          backgroundColor: "var(--bs-body-bg)",
          boxShadow:
            "0 30px 70px -28px color-mix(in srgb, var(--primary-color) 22%, transparent), 0 3px 14px -6px rgba(15, 23, 42, 0.07)",
        }}
      >
        {/* Tinted lid holds the artwork, so the art has a surface of its own
            rather than floating on the page background. */}
        <div
          className="flex justify-center px-8 pb-8 pt-10 md:pb-10 md:pt-14"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--primary-color) 5%, transparent)",
          }}
        >
          <ThemedSvg
            src={MaitanceImage}
            alt={t("under_maintenance")}
            className="w-32 sm:w-36 md:w-44 lg:w-48"
          />
        </div>

        <div className="flex flex-col items-center px-6 pb-9 pt-8 text-center sm:px-10 md:px-14 md:pb-12 md:pt-10">
          {logo && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt=""
              className="mb-5 h-7 w-auto object-contain sm:h-8 md:mb-6 md:h-10"
            />
          )}

          <span
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em]"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--primary-color) 10%, transparent)",
              color: "var(--primary-color)",
            }}
          >
            <span className="relative flex h-1.5 w-1.5">
              <span
                className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-70"
                style={{ backgroundColor: "var(--primary-color)" }}
              />
              <span
                className="relative inline-flex h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: "var(--primary-color)" }}
              />
            </span>
            {t("under_maintenance")}
          </span>

          <h1 className="mt-3 text-2xl font-bold tracking-tight fontColor sm:text-3xl md:mt-4 md:text-4xl lg:text-5xl">
            {t("we_will_be_back_soon")}
          </h1>

          {message && (
            <p className="mt-2 max-w-sm text-sm SecondaryTextColor md:mt-3 md:max-w-md md:text-base">
              {message}
            </p>
          )}

          {showCountdown && (
            <>
              <div
                className="mt-7 h-px w-full md:mt-9"
                style={{ backgroundColor: "var(--border-color)" }}
              />
              {/* `w-full` + shrinkable cells, not a wide gap scale: with four
                  units the old gap-16 pushed the row past the card's padding. */}
              <div className="mt-6 flex w-full items-start justify-center gap-2 sm:gap-4 md:mt-8 md:gap-6 lg:gap-8">
                {cells.map((cell, i) => (
                  <React.Fragment key={cell.key}>
                    {i > 0 && <Separator />}
                    <TimeCell labelKey={cell.labelKey} value={cell.value} />
                  </React.Fragment>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
};

export default MaintanceMode;
