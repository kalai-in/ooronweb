import React from "react";
import { Dialog, DialogContent, DialogOverlay } from "@/components/ui/dialog";
import { LuRotateCcw } from "react-icons/lu";
import * as api from "@/api/apiRoutes";
import { toast } from "react-toastify";
import { t } from "@/utils/translation";
import { useSelector, useDispatch } from "react-redux";
import {
  setCartProducts,
  setCartSubTotal,
  setDoorStepDeliveryMode,
  setSelfPickupMode,
} from "@/redux/slices/cartSlice";

interface ReoderConfirmModalProps {
  showReoderModal: boolean;
  setShowReorderModal: (open: boolean) => void;
  order: any;
  // The channel the ORIGINAL order belongs to ("quick" | "allShop"). Orders are
  // split by list, not by a field — the card passes which list it came from.
  orderChannel?: string;
}

const ReoderConfirmModal = ({
  showReoderModal,
  setShowReorderModal,
  order,
  orderChannel = "allShop",
}: ReoderConfirmModalProps) => {
  const dispatch = useDispatch();
  const theme = useSelector((state: any) => state.Theme.theme);
  const city = useSelector((state: any) => state.City.city);
  // available_modes for the CURRENT location/zone (from home_layout). Quick is
  // serviceable here only when "both" or "quick"; "allShop" → quick unavailable.
  const availableModes = useSelector((state: any) => state.ShopMode.availableModes);

  const handleHideReorder = () => {
    setShowReorderModal(false);
  };

  const handleReoder = async () => {
    // A quick order can only be re-ordered where quick delivery is serviceable.
    const isQuickOrder = orderChannel === "quick";
    const locationSupportsQuick =
      availableModes === "both" || availableModes === "quick";
    if (isQuickOrder && !locationSupportsQuick) {
      toast.error(t("quick_not_available_at_location"));
      setShowReorderModal(false);
      return;
    }
    try {
      const variantIds = order?.items
        ?.map((prdct) => prdct?.variant_id)
        ?.join(",");
      const quantity = order?.items?.map((prdct) => prdct?.quantity)?.join(",");
      // Reorder lands in the ORIGINAL order's channel cart (not the active one).
      const isQuick = isQuickOrder;
      const response = await api.addToBulkCart({
        quick_variant_ids: isQuick ? variantIds : undefined,
        quick_quantities: isQuick ? quantity : undefined,
        ecommerce_variant_ids: isQuick ? undefined : variantIds,
        ecommerce_quantities: isQuick ? undefined : quantity,
        latitude: city?.latitude,
        longitude: city?.longitude,
      });
      if (response.status == 1) {
        toast.success(t("items_added_to_cart"));
        setShowReorderModal(false);
        await fetchCart();
      } else {
        // `message` is a server-authored sentence ("The store is currently
        // closed."), NOT a translation key — running it through t() misses and
        // returns undefined, so the toast rendered blank. Surface it raw, the
        // same way every other call site does.
        toast.error(response?.message || t("something_went_wrong"));
        setShowReorderModal(false);
      }
    } catch (error: any) {
      // A thrown request (network/5xx) left the modal open with no feedback,
      // so the click looked like it did nothing at all.
      console.log("Error", error);
      toast.error(error?.response?.data?.message || t("something_went_wrong"));
      setShowReorderModal(false);
    }
  };

  const fetchCart = async () => {
    try {
      const cartData = await api.getCart({
        latitude: city?.latitude,
        longitude: city?.longitude,
      });
      if (cartData.status == 1) {
        dispatch(setCartSubTotal({ data: cartData?.data?.sub_total }));
        dispatch(setSelfPickupMode({ data: cartData?.data?.self_pickup_mode }));
        dispatch(setDoorStepDeliveryMode({data:cartData?.data?.doorstep_delivery_mode}))
        const productsData = cartData?.data?.cart?.map((item) => ({
          product_id: item?.id,
          product_variant_id: item?.variant_id,
          qty: item?.variants?.[0]?.quantity ?? item?.quantity,
        }));
        dispatch(setCartProducts({ data: productsData }));
      } else {
        dispatch(setCartProducts({ data: [] }));
        dispatch(setCartSubTotal({ data: 0 }));
      }
    } catch (error: any) {
      console.log("Error", error);
    }
  };

  return (
    <Dialog open={showReoderModal} onOpenChange={setShowReorderModal}>
      <DialogOverlay
        className={`${theme == "light" ? "bg-black/50" : "bg-black/70"} backdrop-blur-sm`}
      />
      <DialogContent className="max-w-sm overflow-hidden rounded-2xl border border-[var(--border-color)] p-0" title={t("reorder")}>
        <div className="flex flex-col items-center px-6 pt-7 pb-6 text-center">
          <span
            className="mb-4 flex h-14 w-14 items-center justify-center rounded-full textPrimaryColor"
            style={{
              backgroundColor:
                "color-mix(in srgb, var(--primary-color) 12%, transparent)",
            }}
          >
            <LuRotateCcw size={26} />
          </span>

          <h2 className="font-bold text-lg textColor">{t("reorder")}</h2>
          <p className="mt-1.5 text-sm SecondaryTextColor">
            {t("reOrder_warning")}
          </p>

          <div className="mt-6 grid w-full grid-cols-2 gap-3">
            <button
              className="rounded-xl border border-[var(--border-color)] px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-black/5"
              onClick={handleHideReorder}
            >
              {t("cancel")}
            </button>
            <button
              className="rounded-xl primaryBackColor px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
              onClick={handleReoder}
            >
              {t("Ok")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReoderConfirmModal;
