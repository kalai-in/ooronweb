import { useCallback, useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import * as api from "@/api/apiRoutes";
import { t } from "@/utils/translation";
import { setFavoriteProductIds } from "@/redux/slices/FavoriteSlice";

/**
 * Optimistic + debounced wishlist (favorite) toggle for a single product.
 *
 * Mirrors useDebouncedQuantity: the heart flips instantly, but the network call
 * fires ONCE after the user stops clicking, and only when the final state
 * actually differs from what the server already has.
 *
 * The old per-card handler read "is it liked?" from redux, which only updated
 * AFTER the API responded. Rapid clicks all saw the same stale answer, each fired
 * addToFavorite, and each pushed the id again — an API burst, a toast per
 * response, and duplicate ids in favouriteProductIds.
 *
 * How this fixes it:
 *  - OPTIMISTIC: redux flips on every click, so the heart tracks the clicks and
 *    the next click reads the real next state.
 *  - DEBOUNCED: the call is scheduled `delay` ms after the LAST click.
 *  - NET-CHANGE ONLY: the flush diffs the final state against `baseRef` (the
 *    server state when the burst began). Like→unlike→like = no net change = NO
 *    call at all. Three clicks from unliked = one addToFavorite.
 *
 * Toasts follow the same rule: one per settled burst, not one per click. A
 * no-net-change burst is silent — nothing happened server-side to report.
 *
 * On failure the optimistic state is rolled back to the burst's baseline.
 */
export interface UseFavoriteToggleOptions {
  productId: number | string;
  /** fired after a SUCCESSFUL call with the new liked state (e.g. to run the
   * like-burst animation, or to let a wishlist list drop the card). */
  onToggled?: (liked: boolean) => void;
  /** debounce window (ms), default 500 */
  delay?: number;
}

export interface UseFavoriteToggleResult {
  liked: boolean;
  pending: boolean;
  toggle: (e?: { preventDefault?: () => void; stopPropagation?: () => void }) => void;
}

export function useFavoriteToggle({
  productId,
  onToggled,
  delay = 500,
}: UseFavoriteToggleOptions): UseFavoriteToggleResult {
  const dispatch = useDispatch();
  // jwtToken lives on the User slice root, not on state.User.user.
  const jwtToken = useSelector((state: any) => state.User.jwtToken);
  const favoriteProducts = useSelector(
    (state: any) => state.Favorite.favouriteProductIds,
  );

  // True while a flush's API call is in flight — drives the caller's loading UI.
  const [pending, setPending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Server-side liked state when the current click-burst began; the flush diffs
  // the target against it to decide add / remove / do-nothing. Null between bursts.
  const baseRef = useRef<boolean | null>(null);
  // The state the last click landed on — what the flush will try to persist.
  const targetRef = useRef<boolean | null>(null);
  // Cleared on unmount so a late response can't setState on a dead component.
  const mountedRef = useRef(true);

  const liked = !!favoriteProducts?.includes(productId);

  // Keep live values in refs so the debounced flush never fires on a stale
  // closure and `toggle` stays stable across renders.
  const stateRef = useRef({ favoriteProducts, onToggled });
  useEffect(() => {
    stateRef.current = { favoriteProducts, onToggled };
  });

  // Live liked value. Two clicks in the same tick both read the same render's
  // `liked`, so a render-time read would make the second click a no-op instead of
  // toggling back. This ref advances on every click. It follows redux whenever no
  // burst is in progress, so a change made elsewhere (another card, the wishlist
  // page) is picked up.
  const liveRef = useRef(liked);
  useEffect(() => {
    if (baseRef.current == null) liveRef.current = liked;
  });

  // On unmount: cancel a pending flush. A burst still in its debounce window is
  // dropped — nothing was sent, so there is nothing to reconcile.
  useEffect(
    () => () => {
      mountedRef.current = false;
      clearTimeout(timer.current ?? undefined);
    },
    [],
  );

  const applyIds = useCallback(
    (nextLiked: boolean | null) => {
      const ids = stateRef.current.favoriteProducts || [];
      // Filter on both paths: on the add path it also drops any duplicate id an
      // earlier double-click may have left behind.
      const nextIds = nextLiked
        ? [...ids.filter((id: any) => id != productId), productId]
        : ids.filter((id: any) => id != productId);
      dispatch(setFavoriteProductIds({ data: nextIds }));
    },
    [dispatch, productId],
  );

  const scheduleFlush = useCallback(() => {
    clearTimeout(timer.current ?? undefined);
    timer.current = setTimeout(async () => {
      const target = targetRef.current;
      const base = baseRef.current;
      // Burst settled — reset the baseline for the next one.
      baseRef.current = null;
      // Clicked back to where it started (like→unlike→like) — nothing to send.
      if (target == null || target === base) return;

      setPending(true);
      try {
        const response = target
          ? await api.addToFavorite({ product_id: productId })
          : await api.removeFromFavorite({ product_id: productId });

        if (response?.status == 1) {
          stateRef.current.onToggled?.(target);
          toast.success(response.message);
        } else {
          applyIds(base); // roll back to the burst's baseline
          toast.error(response?.message);
        }
      } catch (error) {
        console.log("Error", error);
        applyIds(base); // roll back to the burst's baseline
      } finally {
        if (mountedRef.current) setPending(false);
      }
    }, delay);
  }, [applyIds, delay, productId]);

  const toggle = useCallback(
    (e?: { preventDefault?: () => void; stopPropagation?: () => void }) => {
      e?.preventDefault?.();
      e?.stopPropagation?.();

      if (!jwtToken) {
        // toastId dedupes rapid repeat clicks (guest spamming the heart) into
        // one toast instead of stacking a new one per click — same pattern as
        // max_cart_limit_error elsewhere in the codebase.
        toast.error(t("required_login_message_for_wishlist"), {
          toastId: "required_login_message_for_wishlist",
        });
        return;
      }

      // First click of a burst: remember the server-side state to diff against.
      if (baseRef.current == null) baseRef.current = liveRef.current;

      const next = !liveRef.current;
      liveRef.current = next;
      targetRef.current = next;
      applyIds(next); // optimistic — heart flips now
      scheduleFlush();
    },
    [applyIds, jwtToken, scheduleFlush],
  );

  return { liked, pending, toggle };
}
