import type { Metadata, Viewport } from "next";
import { Instrument_Sans } from "next/font/google";
import "@/styles/globals.css";
import Providers from "./Providers";
import FontAwesomeLoader from "./FontAwesomeLoader";

// Variable font: one file covering the whole wght axis, rather than four static
// cuts. Instrument Sans tops out at 700 where Nunito went to 900, and the markup
// still has ~50 font-extrabold/font-black (800/900) usages — those clamp to 700
// instead of pulling a separate file per weight.
const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-family",
  display: "swap",
});

export const metadata: Metadata = {
  // Without this, Next infers the base for relative OG/Twitter image URLs
  // from the incoming request host — wrong behind a reverse proxy, and noisy
  // (a build-time warning on every page). Every migrated page passes an
  // absolute ogImage/ogUrl already, so this is mostly a safety net for any
  // relative fallback (e.g. buildPageMetadata's "/favicon.webp" default).
  metadataBase: process.env.NEXT_PUBLIC_BASE_URL
    ? new URL(process.env.NEXT_PUBLIC_BASE_URL)
    : undefined,
  applicationName: process.env.NEXT_PUBLIC_WEB_NAME,
  appleWebApp: {
    title: process.env.NEXT_PUBLIC_WEB_NAME,
    statusBarStyle: "default",
  },
  // manifest.webmanifest is auto-linked from src/app/manifest.ts — no need
  // to declare it here.
  icons: {
    icon: "/favicon.webp",
    apple: "/icons/apple-touch-icon.png",
  },
};

// No maximum-scale/user-scalable=no. Blocking pinch-zoom fails WCAG 1.4.4
// (Resize Text) and is what Lighthouse's "[user-scalable=no] is used" audit
// flags. Low-vision users on mobile need to zoom; the layout is responsive,
// so nothing breaks when they do. Matches MetaData.jsx's viewport tag.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preconnectors */}
        <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossOrigin="" />
        {/* Instrument Sans is self-hosted via next/font above — no Google
            Fonts CDN needed (no render-blocking link, no unused families). */}
        <FontAwesomeLoader />
      </head>
      <body className="antialiased !pointer-events-auto">
        <main className={`${instrumentSans.variable} `}>
          <Providers>{children}</Providers>
        </main>
      </body>
    </html>
  );
}
