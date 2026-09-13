"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Carries the zone slug the SERVER actually used to render a zone-less page
 * (currently the bare "/" home), so links built by useZoneHref() can be
 * zone-prefixed in the SSR HTML itself.
 *
 * Why a context and not the LanguageCodesSeed/Redux route: that seed dispatches
 * from an effect, which runs after the first paint — far too late for the
 * markup a crawler reads. This value is a plain prop passed down through the
 * React tree, so it is present during server render AND during the first client
 * render, identical on both sides — no hydration mismatch (unlike the persisted
 * `selectedZone`, which is why useZoneHref gates that one on `hydrated`).
 *
 * Only a FALLBACK: a real /{zone}/... URL still wins, since useZoneHref reads
 * its own route param first. Null when no zone could be resolved at all.
 */
const SsrZoneContext = createContext<string | null>(null);

export const useSsrZone = () => useContext(SsrZoneContext);

export default function SsrZoneProvider({
  zone = null,
  children,
}: {
  zone?: string | null;
  children: ReactNode;
}) {
  return (
    <SsrZoneContext.Provider value={zone}>{children}</SsrZoneContext.Provider>
  );
}
