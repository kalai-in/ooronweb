// Parses the API's "N minutes"/"N mins"/"N" style delivery-time strings into
// milliseconds. Returns null when unparseable so callers can fall back to
// "no estimate" UI instead of rendering NaN.
export const parseDeliverTimeToMs = (
  raw?: string | null,
): number | null => {
  if (raw == null) return null;
  const match = String(raw).trim().match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const minutes = Number(match[1]);
  return Number.isFinite(minutes) ? minutes * 60 * 1000 : null;
};

// Remaining time is always derived from the createdAt anchor, never
// decremented locally — this is what makes closing/reopening the tracking
// modal resume correctly instead of restarting the countdown.
export const getRemainingMs = (
  createdAtIso: string,
  totalMs: number,
  nowMs: number = Date.now(),
): number => {
  const createdMs = new Date(createdAtIso).getTime();
  if (!Number.isFinite(createdMs)) return 0;
  return Math.max(0, totalMs - (nowMs - createdMs));
};

export const formatMsAsClock = (ms: number): string => {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

// "N minutes"/"1 minute" style display, rounding up so a near-zero remainder
// still reads as "1 minute" rather than "0 minutes" until it's truly done.
// At 0 (countdown elapsed) shows "reaching you soon" instead of "0 minutes".
export const formatMsAsMinutes = (ms: number): string => {
  const minutes = Math.max(0, Math.ceil(ms / 60000));
  if (minutes === 0) return "reaching you soon";
  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
};
