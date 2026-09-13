import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { t } from "@/utils/translation";
import { formatDuration, parseUtc, windowKey } from "@/utils/maintenanceWindow";

/**
 * MaintenanceNotice
 *
 * Heads-up toast for a maintenance window that is SCHEDULED but not yet live —
 * `website_mode == 0` while `website_mode_start` / `_end` point at a future
 * slot. Warns shoppers before the site goes down mid-checkout.
 *
 * Once the window actually opens (`website_mode == 1`) Layout swaps in the
 * full-screen MaintanceMode splash instead, so this only ever covers the
 * "coming soon" phase.
 *
 * Shown once per window: dismissal is persisted in localStorage under a key
 * derived from the window's own timestamps, so a refresh keeps it hidden while
 * rescheduling to new dates re-notifies.
 */
const MaintenanceNotice = () => {
  const setting = useSelector((state: any) => state.Setting);
  const web = setting?.setting?.web_settings;

  const mode = String(web?.website_mode ?? "");
  const startAt = web?.website_mode_start;
  const endAt = web?.website_mode_end;

  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  // Held in state (not read inline) so the countdown ticks and the toast can
  // retire itself the moment the window opens.
  const [now, setNow] = useState<number | null>(null);

  const startTime = parseUtc(startAt);
  const endTime = parseUtc(endAt);

  // A window is "upcoming" only while the site is still live (mode 0) and the
  // start is genuinely in the future. Everything else — no dates, mode already
  // 1, start already passed — means there is nothing to warn about.
  const isUpcoming =
    mode === "0" && startTime !== null && now !== null && startTime > now;

  useEffect(() => {
    // Mount-gated: `setting` comes from redux-persist, which rehydrates after
    // first paint, and Date.now() differs server vs client. Reading either
    // during SSR would desync hydration, so the toast only ever evaluates on
    // the client. See t-hydration-hazard.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!isUpcoming) {
      // intentional: syncs visibility from the isUpcoming window calculation,
      // which itself depends on the mount-gated `now` clock above.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(false);
      return;
    }
    try {
      if (localStorage.getItem(windowKey(startAt, endAt)) === "1") return;
    } catch {
      /* storage blocked (private mode) — fall through and show it */
    }
    setVisible(true);
  }, [isUpcoming, startAt, endAt]);

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(windowKey(startAt, endAt), "1");
    } catch {
      /* ignore storage errors */
    }
    setClosing(true);
    setTimeout(() => {
      setVisible(false);
      setClosing(false);
    }, 250);
  }, [startAt, endAt]);

  if (!visible || !isUpcoming) return null;

  // Times on the visitor's own clock — the stored values are UTC, which almost
  // nobody can convert at a glance.
  const dateTimeFmt = new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const timeOnlyFmt = new Intl.DateTimeFormat(undefined, {
    timeStyle: "short",
  });

  // isUpcoming (checked above) guarantees startTime is set by this point.
  const startLabel = dateTimeFmt.format(startTime as number);

  // Same calendar day (in the VIEWER's zone, which is why this compares
  // formatted dates rather than UTC ones) → show just the end time, so it
  // reads "Jul 29, 4:21 PM – 4:24 PM" instead of repeating the date.
  const endLabel = endTime
    ? new Date(endTime).toDateString() ===
      new Date(startTime as number).toDateString()
      ? timeOnlyFmt.format(endTime)
      : dateTimeFmt.format(endTime)
    : null;

  const duration =
    endTime && startTime ? formatDuration(endTime - startTime) : null;

  return (
    <div
      // `inset-inline-start` (logical) rather than left/right: <html dir> flips
      // for Urdu and friends, so a hardcoded `right-5` strands the toast on the
      // wrong side. One logical property per breakpoint avoids stacking
      // `left-auto` against an `rtl:left-5` and relying on CSS source order.
      // Mobile centres via -translate-x-1/2, which is direction-agnostic.
      className={`fixed bottom-4 start-1/2 z-[9998] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 transition-all duration-250 rtl:translate-x-1/2 sm:start-auto sm:end-5 sm:translate-x-0 sm:rtl:translate-x-0 ${
        closing ? "translate-y-3 opacity-0" : "translate-y-0 opacity-100"
      }`}
      role="status"
      aria-live="polite"
    >
      <div
        // ps/pe are logical: the close button's gutter follows the text
        // direction instead of always sitting on the right.
        className="relative flex gap-3 rounded-2xl border p-4 pe-10 text-start"
        style={{
          backgroundColor: "var(--bs-body-bg)",
          borderColor: "var(--border-color)",
          boxShadow: "0 18px 40px -18px rgba(15, 23, 42, 0.28)",
        }}
      >
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
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
        </span>

        <div className="min-w-0">
          <p className="text-sm font-semibold fontColor">
            {t("scheduled_maintenance")}
          </p>
          {/* The timestamp and duration are neutral/numeric runs. Dropped raw
              into RTL text, bidi reorders them against the surrounding words
              (the "·" can jump sides, the date can split). `unicode-bidi:
              isolate` keeps each run as one atomic unit whichever way the
              paragraph flows. */}
          <p className="mt-0.5 text-xs SecondaryTextColor">
            {t("site_will_be_down_from")}{" "}
            {/* Whole range isolated as ONE run: isolating the two timestamps
                separately would let bidi reorder them around the dash, so an
                RTL reader could see the end time first. */}
            <span className="font-medium fontColor [unicode-bidi:isolate]">
              {startLabel}
              {endLabel ? ` – ${endLabel}` : ""}
            </span>
            {duration ? (
              <>
                {" · "}
                <span className="[unicode-bidi:isolate]">{duration}</span>
              </>
            ) : null}
          </p>
        </div>

        <button
          type="button"
          onClick={dismiss}
          aria-label={t("close")}
          className="absolute end-2 top-2 flex h-7 w-7 items-center justify-center rounded-full opacity-60 transition-opacity hover:opacity-100"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            className="h-3.5 w-3.5 fontColor"
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default MaintenanceNotice;
