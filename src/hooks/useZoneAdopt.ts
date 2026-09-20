import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useParams } from "next/navigation";
import { setSelectedZone } from "@/redux/slices/locationModalSlice";
import * as api from "@/api/apiRoutes";

/**
 * Adopts the zone from the URL into Redux — the zone equivalent of _app's
 * URL→Redux language sync.
 *
 * Why this exists: selectedZone was only ever set by the location modal. A user
 * landing on /bhuj-quick (a shared link, a Google result) had no zone in Redux,
 * so the moment they navigated to a page that ISN'T zone-prefixed
 * (/categories/all, /cart), useZoneHref lost its fallback and every subsequent
 * link dropped the zone.
 *
 * Resolves the FULL zone object { id, name, slug } from the zones list (not
 * just a slug placeholder): selectedZone.name is the canonical zone identity
 * Header renders (see Header.tsx) — a direct URL load / refresh must produce
 * the same complete zone object the modal's chip-click flow already does, or
 * Header would show blank/stale text for every zone reached by URL instead
 * of by picking a chip.
 *
 * useParams().zone is Next's own resolved route param — if it's present, the
 * router already confirmed this route matched the [lang]/(zoned)/[zone]/...
 * branch, so no shape-guessing ("could this segment be a zone, or is it a
 * language code that hasn't loaded yet?") is needed anymore.
 */
const useZoneAdopt = () => {
  const params = useParams<{ zone?: string }>();
  const dispatch = useDispatch();
  const storedSlug = useSelector(
    (state: any) => state?.LocationModal?.selectedZone?.slug,
  );
  // Tracks the URL zone this effect has already started adopting, SEPARATE
  // from storedSlug. The placeholder dispatch below sets storedSlug to
  // urlZone before the full {id,name} resolution finishes — if storedSlug
  // itself gated re-runs (via the dep array or the read below), that
  // placeholder write would immediately look like "already adopted",
  // re-running this effect and tearing down (active=false) the in-flight
  // getZones() call before it can dispatch the full object. name/id would
  // then stay null forever for every direct zoned URL load. This ref lets
  // the effect start the resolution exactly once per urlZone regardless of
  // what the placeholder dispatch does to storedSlug in the meantime.
  const adoptingRef = useRef<string | null>(null);

  useEffect(() => {
    const urlZone = params?.zone ?? null;
    // No zone in the URL: leave Redux alone. The user's stored pick must
    // survive a visit to /cart — unlike language, absence means "unknown here",
    // not "default".
    if (!urlZone || urlZone === storedSlug) return;
    if (adoptingRef.current === urlZone) return;
    adoptingRef.current = urlZone;

    // A manual zone switch (Location.tsx handleConfirmLocation) dispatches
    // the NEW zone into Redux, THEN pushes the matching URL — router.push()
    // doesn't update useParams() synchronously, so this effect can re-run
    // with the OLD route param still in scope right after that dispatch: it
    // sees urlZone (stale) != storedSlug (just-set), and would adopt the
    // stale URL's zone right back — a visible flash back to the old zone
    // before the pending navigation lands and this effect corrects it again.
    // Deferring one tick lets `params.zone` catch up first so this only
    // fires for a REAL external mismatch (typed/shared zone URL, browser
    // back/forward), not our own in-flight navigation. Same fix as
    // AppContent.tsx's URL->Redux language adoption for the identical race.
    let active = true;
    const timer = setTimeout(async () => {
      if (!active) return;
      if (process.env.NODE_ENV !== "production") {
        console.log("[ZONE TRACE] source=useZoneAdopt (placeholder)", {
          urlZone,
          storedSlug,
        });
      }
      // Seed a slug-only placeholder immediately so useZoneHref/consumers
      // that only need `.slug` aren't blocked on this network round-trip —
      // then upgrade to the full object once resolved, IF still the latest
      // pending adoption (a second rapid zone change must not let this
      // slower resolution overwrite it after the fact).
      dispatch(setSelectedZone({ id: null, name: null, slug: urlZone }));
      try {
        const zonesRes = await api.getZones();
        const zones = zonesRes?.data || [];
        const match = zones.find((z: any) => z?.slug === urlZone);
        if (!active || !match) return;
        if (process.env.NODE_ENV !== "production") {
          console.log("[ZONE TRACE] source=useZoneAdopt (resolved)", {
            id: match.id,
            name: match.name,
            slug: match.slug,
          });
        }
        dispatch(
          setSelectedZone({ id: match.id, name: match.name, slug: match.slug }),
        );
      } catch (err: any) {
        console.log("[zone-adopt] zone name resolve failed:", err?.message);
      }
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
    // storedSlug deliberately excluded: the placeholder dispatch inside this
    // effect writes storedSlug to urlZone before the full-object resolution
    // finishes — including storedSlug here would re-run this effect on that
    // write, tearing down (active=false) the in-flight getZones() call before
    // it can dispatch {id,name}. adoptingRef (not a dep) guards re-entry
    // instead, so this effect only re-runs on a REAL params.zone change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.zone, dispatch]);
};

export default useZoneAdopt;
