/**
 * Helpers for the `web_settings.website_mode*` maintenance window.
 *
 * Shared by MaintanceMode (the full-screen splash shown while a window is
 * live) and MaintenanceNotice (the heads-up toast shown before one starts),
 * so both read the admin's timestamps exactly the same way.
 */

/**
 * The settings API returns maintenance windows as bare datetime strings with no
 * timezone marker ("2026-07-29 06:20:00"), which `new Date()` would read in the
 * *visitor's* local zone — so the same window would end at a different instant
 * for every timezone. Pin them to UTC (the zone the admin panel stores) so the
 * countdown reads identically worldwide, then format back into the visitor's
 * own zone for display.
 *
 * Returns null for missing/unparseable input so callers can hide the timer
 * rather than render "NaN".
 */
export const parseUtc = (value) => {
  if (!value || typeof value !== "string") return null;
  const m = value
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) {
    const fallback = Date.parse(value);
    return Number.isNaN(fallback) ? null : fallback;
  }
  const [, y, mo, d, h, mi, s] = m;
  return Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s || 0));
};

/**
 * Stable identity for one scheduled window, used as the dismissal key. Keyed on
 * the timestamps rather than a counter so that rescheduling to new dates counts
 * as a NEW window and re-notifies, while a refresh within the same window stays
 * dismissed.
 */
export const windowKey = (startAt, endAt) =>
  `maintenance_notice_dismissed_${startAt || ""}_${endAt || ""}`;

/** Human duration for a span, e.g. "about 5 minutes" / "about 2 hours". */
export const formatDuration = (ms) => {
  if (!ms || ms <= 0) return null;
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
};
