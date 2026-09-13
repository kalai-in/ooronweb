import type { MetadataRoute } from "next";
import { getSettingServer } from "@/api/serverApi";

// Without this, Next treats manifest() as static (no request-bound data used
// at build time) and generates it ONCE — every visitor then gets whatever
// pwa_name/icon the settings API returned at build time, not live admin edits.
export const dynamic = "force-dynamic";

// Next.js special file — auto-served at /manifest.webmanifest. Reads the
// admin's PWA settings (pwa_name/pwa_description/pwa_icon) at request time so
// white-label clients get their own name/icon without a rebuild — falls back
// to the env values when settings are unreachable or a client hasn't
// configured them yet.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const fallbackName = process.env.NEXT_PUBLIC_WEB_NAME || "App";
  let name = fallbackName;
  let description = process.env.NEXT_PUBLIC_META_TITLE || fallbackName;
  let iconUrl: string | null = null;
  let iconType = "image/png";

  try {
    const res = await getSettingServer({});
    // pwa_name/pwa_description/pwa_icon live under data.web_settings, not
    // top-level data (verified against the live settings response).
    const webSettings = res?.data?.web_settings;
    if (webSettings?.pwa_name) name = webSettings.pwa_name;
    if (webSettings?.pwa_description) description = webSettings.pwa_description;
    // pwa_icon comes back as a path relative to the apex host's /storage/
    // (e.g. "front_end/pwa_icon/xyz.webp"), unlike favicon/web_logo which the
    // API already returns as full URLs.
    if (webSettings?.pwa_icon) {
      iconUrl = `${process.env.NEXT_PUBLIC_API_URL}/storage/${webSettings.pwa_icon}`;
      const ext = webSettings.pwa_icon.split(".").pop()?.toLowerCase();
      iconType =
        ext === "webp"
          ? "image/webp"
          : ext === "jpg" || ext === "jpeg"
            ? "image/jpeg"
            : ext === "svg"
              ? "image/svg+xml"
              : "image/png";
    }
  } catch {
    // Falls through to the env/static defaults below.
  }

  return {
    name,
    short_name: name,
    description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#000000",
    icons: iconUrl
      ? [
          { src: iconUrl, sizes: "192x192", type: iconType, purpose: "any" },
          { src: iconUrl, sizes: "512x512", type: iconType, purpose: "any" },
        ]
      : [
          {
            src: "/icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
        ],
  };
}
