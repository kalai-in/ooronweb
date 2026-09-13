// Server-side device bucket for the home_layout payload.
//
// The client picks its bucket from window.innerWidth (app <768, tablet 768-1024,
// web >1024 — see HomeLayout/Layout). The server has no viewport, so SSR reads
// the User-Agent instead. It is the only device signal in the request.
//
// The two can disagree (a desktop browser in a narrow window is "web" by UA but
// "tablet" by width). That is harmless: the device is part of the react-query
// key, so a disagreement just means the client refetches its own bucket, exactly
// as it does today. Matching the common case is what saves the round-trip.
export const deviceFromUserAgent = (
  userAgent?: string | null,
): "web" | "tablet" | "app" => {
  const ua = String(userAgent || "");
  if (!ua) return "web";
  // Order matters: iPad/Android tablets also match the mobile patterns below.
  if (/iPad|Tablet|PlayBook|Silk|(Android(?!.*Mobile))/i.test(ua)) return "tablet";
  if (/Mobile|iPhone|iPod|Android|BlackBerry|Opera Mini|IEMobile/i.test(ua)) {
    return "app";
  }
  return "web";
};
