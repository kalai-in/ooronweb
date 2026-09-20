// Zone-aware SEO row selection for get_seo_settings responses.
//
// The API returns EVERY row for a page_type — one per zone plus a default
// (is_default: 1, zone_id: 0). Selection rule:
//   1. Zone URL (/bhuj-quick/...)  → that zone's row (zone_id match)
//   2. No row for the zone, or bare URL with no zone → the is_default row
//   3. No default flagged (misconfigured admin) → first row, last resort
//
// Fields may arrive top-level (meta_title) or nested under `translations`
// (localized responses) — `pick` prefers the translation, falls back to the
// raw column, so both response shapes work.
export const selectSeoRow = (rows: any[], zoneId: number | null = null): any => {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const zoneRow =
    zoneId != null
      ? rows.find((r) => Number(r?.zone_id) === Number(zoneId))
      : null;
  const defaultRow = rows.find((r) => Number(r?.is_default) === 1);
  return zoneRow || defaultRow || rows[0];
};

export const pickSeoField = (row: any, key: string): any =>
  row?.translations?.[key] ?? row?.[key] ?? null;
