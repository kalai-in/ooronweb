import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Optimistic + debounced quantity stepper for the cart.
 *
 * The backend has no "decrement" endpoint — a quantity change is an upsert via
 * addToCart(id, variant, newQty), and reaching 0 means removeFromCart. Rapid
 * +/- clicks therefore each fire a network call that reads a stale cart snapshot
 * from the click handler's closure → race → wrong final quantity + a burst of
 * requests.
 *
 * This hook fixes both: it shows the new quantity instantly (local optimistic
 * state) and fires exactly ONE network call after the user stops clicking,
 * sending the final target quantity.
 *
 * IMPORTANT: all the +/- math and side effects live OUTSIDE the setState
 * updater. React StrictMode (dev) double-invokes updater functions, so doing the
 * increment/decrement or scheduling the flush inside the updater ran them twice
 * → a single "-" click could land on the wrong number (even go up). We track the
 * live value in a ref and compute the next value once, imperatively.
 *
 * Guest carts are local-only (pure redux, no network), so they don't use this —
 * callers keep their existing instant guest path.
 *
 * Out-of-order protection: each debounced flush gets a monotonically increasing
 * request id. The id (and an isStale() checker) is handed to onCommit/onRemove so
 * the caller can DROP a response whose newer sibling has already fired — this is
 * what stops a slow earlier response from overwriting Subtotal/Total with stale
 * (or 0) values. `pending` is true while a flush is in flight, for loading UI.
 *
 */
export interface FlushCtx {
  reqId: number;
  isStale: () => boolean;
}

export interface UseDebouncedQuantityOptions {
  /** authoritative qty from the cart store */
  serverQty: number;
  /** set qty to N (>0) on server (used on increase). ctx.isStale() → true once a newer
   * flush has started; the caller must NOT dispatch totals when stale. */
  onCommit?: (qty: number, ctx: FlushCtx) => void | Promise<void>;
  /** drop `units` from the line via the remove endpoint (used on decrease). Same ctx contract. */
  onRemove?: (units: number, ctx: FlushCtx) => void | Promise<void>;
  /** clamp ceiling (allowed/stock); optional */
  max?: number;
  /** called when a +click is blocked by max */
  onMax?: () => void;
  /** debounce window (ms), default 500 */
  delay?: number;
}

export interface UseDebouncedQuantityResult {
  displayQty: number;
  increment: () => void;
  decrement: () => void;
  pending: boolean;
}

export function useDebouncedQuantity({
  serverQty,
  onCommit,
  onRemove,
  max,
  onMax,
  delay = 500,
}: UseDebouncedQuantityOptions): UseDebouncedQuantityResult {
  // null = "follow the server value"; a number = a pending optimistic override.
  const [optimistic, setOptimistic] = useState<number | null>(null);
  // True while a flush's API call is in flight — drives the caller's loading UI.
  const [pending, setPending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const targetRef = useRef<number | null>(null);
  // Monotonic id stamped on each flush. The latest flush's id is the only one whose
  // response is allowed to write totals; older in-flight responses are stale.
  const reqSeqRef = useRef(0);
  // How many flushes are still in flight, so `pending` only clears when ALL settle.
  const inFlightRef = useRef(0);
  // Server qty when the current click-burst began. Flush diffs target against
  // this to decide direction: target > base → increase (onCommit); target < base
  // → decrease (onRemove, dropping base-target units). Null between bursts.
  const baseRef = useRef<number | null>(null);
  // Live current value, so consecutive clicks within the same render compound
  // correctly without reading a stale `optimistic`/`serverQty` closure.
  const liveRef = useRef(serverQty);

  // Keep callbacks/opts in refs so the click handlers stay stable and never use
  // a stale closure when the debounced flush finally fires.
  const cbRef = useRef({ onCommit, onRemove, onMax, max });
  useEffect(() => {
    cbRef.current = { onCommit, onRemove, onMax, max };
  });

  // Latest server qty, readable from the flush's setTimeout closure (which
  // otherwise only sees the value from whichever render scheduled it).
  const serverQtyRef = useRef(serverQty);
  useEffect(() => {
    serverQtyRef.current = serverQty;
  });

  // Reset the burst baseline once a flush completes (the server qty becomes the
  // new baseline for the next burst).
  const captureBase = useCallback(() => {
    if (baseRef.current == null)
      baseRef.current = liveRef.current ?? serverQty ?? 0;
  }, [serverQty]);

  const displayQty = optimistic != null ? optimistic : serverQty;

  // Once the server catches up to our optimistic value, drop the override so we
  // resume mirroring the store (and reflect changes made elsewhere, e.g. cart).
  useEffect(() => {
    if (optimistic != null && serverQty === optimistic) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clear optimistic override once server catches up
      setOptimistic(null);
      liveRef.current = serverQty;
    } else if (optimistic == null) {
      // No pending change → mirror the store.
      liveRef.current = serverQty;
    }
  }, [serverQty, optimistic]);

  const scheduleFlush = useCallback(() => {
    clearTimeout(timer.current ?? undefined);
    timer.current = setTimeout(async () => {
      const target = targetRef.current;
      const base = baseRef.current ?? 0;
      // Burst settled — reset baseline for the next one.
      baseRef.current = null;
      if (target == null || target === base) return; // no net change, no call

      // Stamp this flush. Only the LATEST id may write totals; any response that
      // returns after a newer flush has begun is dropped via isStale().
      const reqId = ++reqSeqRef.current;
      const isStale = () => reqId !== reqSeqRef.current;
      const ctx = { reqId, isStale };

      inFlightRef.current += 1;
      setPending(true);
      try {
        if (target < base) {
          // Net decrease → remove (base - target) units via the remove endpoint.
          await cbRef.current.onRemove?.(base - target, ctx);
        } else {
          // Net increase → upsert the new absolute qty.
          await cbRef.current.onCommit?.(target, ctx);
        }
      } catch {
        // Commit rejected (bad status or network error) — the optimistic qty
        // was never actually saved, so drop it and snap back to the server's
        // real value. Skipped if a newer flush has since started: that flush
        // owns `optimistic` now, and reverting here would clobber it.
        if (!isStale()) {
          setOptimistic(null);
          liveRef.current = serverQtyRef.current;
        }
      } finally {
        inFlightRef.current = Math.max(0, inFlightRef.current - 1);
        if (inFlightRef.current === 0) setPending(false);
      }
    }, delay);
  }, [delay]);

  const increment = useCallback(() => {
    captureBase();
    const current = liveRef.current ?? 0;
    const cap = cbRef.current.max;
    if (cap != null && current >= cap) {
      cbRef.current.onMax?.();
      return;
    }
    const next = current + 1;
    liveRef.current = next;
    targetRef.current = next;
    setOptimistic(next);
    scheduleFlush();
  }, [captureBase, scheduleFlush]);

  const decrement = useCallback(() => {
    captureBase();
    const current = liveRef.current ?? 0;
    const next = Math.max(0, current - 1);
    liveRef.current = next;
    targetRef.current = next;
    setOptimistic(next);
    scheduleFlush();
  }, [captureBase, scheduleFlush]);

  // On unmount: cancel a pending flush AND bump the seq so any already in-flight
  // response sees isStale()===true and skips its dispatch (no setState-after-unmount).
  useEffect(
    () => () => {
      clearTimeout(timer.current ?? undefined);
      reqSeqRef.current += 1;
    },
    [],
  );

  return { displayQty, increment, decrement, pending };
}
