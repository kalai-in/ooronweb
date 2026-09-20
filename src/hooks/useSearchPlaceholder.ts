import { useEffect, useState } from "react";
import { useSelector } from "react-redux";

const ROTATE_MS = 2500;

/**
 * Rotating search suggestion, cycling the zone's `search_suggestions` (from
 * home_layout — so the names shown are products that zone actually stocks, and
 * they change with location/channel).
 *
 * Returns the CURRENT suggestion plus its index (the index is the animation
 * key — it's what tells framer-motion a new item slid in). Returns a null
 * suggestion when the list is empty, so the caller can fall back to a plain
 * static placeholder.
 *
 * Pauses while the user is typing — `active: false` freezes rotation, since a
 * placeholder moving under a half-typed query is just noise.
 */
interface UseSearchPlaceholderOptions {
  active?: boolean;
}

interface UseSearchPlaceholderResult {
  suggestion: any | null;
  index: number;
  hasSuggestions: boolean;
}

const useSearchPlaceholder = ({
  active = true,
}: UseSearchPlaceholderOptions = {}): UseSearchPlaceholderResult => {
  const suggestions = useSelector(
    (state: any) => state?.ShopMode?.searchSuggestions,
  );
  const [index, setIndex] = useState(0);

  const list = Array.isArray(suggestions) ? suggestions : [];

  useEffect(() => {
    // Nothing to rotate through — a single suggestion doesn't need a timer.
    if (!active || list.length < 2) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % list.length);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [active, list.length]);

  // The list can shrink on a zone switch; keep the index in range.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- re-sync rotation index when list shrinks on zone switch
    if (index >= list.length) setIndex(0);
  }, [list.length, index]);

  const safeIndex = index < list.length ? index : 0;

  return {
    suggestion: list.length ? list[safeIndex] : null,
    index: safeIndex,
    hasSuggestions: list.length > 0,
  };
};

export default useSearchPlaceholder;
