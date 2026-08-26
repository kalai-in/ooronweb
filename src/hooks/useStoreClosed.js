import { useSelector } from "react-redux";
import { toast } from "react-toastify";
import { t } from "@/utils/translation";

/**
 * `store_closed: 1` from the home_layout API — the zone/channel is closed for
 * business right now.
 *
 * This is the *soft* close, distinct from the `status: 0` response that replaces
 * the whole page with <StoreClosed>: here the catalogue still renders and stays
 * fully browsable, only the buy path is blocked. Every add-to-cart and the place
 * order call are already rejected at the API layer (src/api/apiRoutes.js); this
 * hook is the UI half — buttons keep their normal shape (Zomato-style) but read
 * as inert and explain themselves on click.
 *
 * `guard(handler)` wraps a click handler: while closed it swallows the click and
 * toasts instead. The button is deliberately NOT given the `disabled` attribute —
 * a disabled button swallows its own click and the user gets no explanation. Use
 * `closedProps` for the matching visual/a11y treatment.
 */
const useStoreClosed = () => {
  const storeClosed =
    useSelector((state) => state.ShopMode?.storeClosed) === true;

  const notifyClosed = () => {
    toast.error(t("store_closed_cannot_order"));
  };

  const guard =
    (handler) =>
    (...args) => {
      if (storeClosed) {
        args[0]?.preventDefault?.();
        args[0]?.stopPropagation?.();
        notifyClosed();
        return;
      }
      return handler?.(...args);
    };

  // Spread onto a buy-path button so it looks inert while staying clickable.
  // `grayscale` drains the brand colour (the primary blue on Add/Buy Now) rather
  // than just fading it, matching the greyed product imagery — opacity alone left
  // the CTAs reading as live.
  const closedProps = storeClosed
    ? {
        "aria-disabled": true,
        title: t("store_closed_cannot_order"),
        className: "grayscale opacity-60",
      }
    : {};

  // Non-interactive decorations that should drain with the rest of the card while
  // closed — the discount ribbon most of all, since a coloured "40% OFF" on a grey
  // card reads as an offer you can still act on.
  const closedDecorClass = storeClosed ? "grayscale" : "";

  return { storeClosed, notifyClosed, guard, closedProps, closedDecorClass };
};

export default useStoreClosed;
