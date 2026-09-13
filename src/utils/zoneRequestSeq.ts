// Shared staleness guard for zone/city resolution. Header.tsx's fetchCity has
// a multi-await chain (getZones -> getZone -> optional reverseGeocode) with no
// cancellation of its own; if the user picks a new zone via Location.tsx while
// an older fetchCity call is still in flight, the old call's dispatch(setCity(...))
// can land AFTER the new zone's and silently revert it. Both call sites bump
// this counter before starting/finishing their write so a superseded call can
// detect it and drop its write instead of committing stale data.
let seq = 0;

export const nextZoneRequestSeq = (): number => ++seq;
export const currentZoneRequestSeq = (): number => seq;
