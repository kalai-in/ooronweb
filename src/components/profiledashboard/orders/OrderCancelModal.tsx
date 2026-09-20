import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { RiCloseFill } from "react-icons/ri";
import { t } from "@/utils/translation";
import * as api from "@/api/apiRoutes";
import { toast } from "react-toastify";

interface OrderCancelModalProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  order: any;
  onCancelled?: () => void;
}

// Order-level cancel (Myntra-style) used from the order-list cards. The backend
// update_order_status takes a single order_item_id, so to cancel the whole order
// we fire one status=7 call per item. Distinct from the detail-page
// CancelReasonModal which cancels a single selected item.
const OrderCancelModal = ({ open, setOpen, order, onCancelled }: OrderCancelModalProps) => {
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");

  const handleHide = () => {
    if (loading) return;
    setReason("");
    setOpen(false);
  };

  const handleCancelOrder = async () => {
    if (!reason.trim()) {
      toast.error(t("reason_is_required"));
      return;
    }
    const items = Array.isArray(order?.items) ? order.items : [];
    if (items.length === 0) {
      toast.error(t("something_went_wrong"));
      return;
    }
    setLoading(true);
    try {
      const results: any[] = await Promise.all(
        items.map((it: any) =>
          api
            .changeOrderStatus({
              orderId: order?.id,
              orderItemId: it?.id,
              status: 7,
              reason,
            })
            .catch(() => null),
        ),
      );
      const ok = results.some((r) => r?.status == 1);
      if (ok) {
        toast.success(t("order_cancelled") || results.find((r) => r?.status == 1)?.message);
        setReason("");
        setOpen(false);
        onCancelled?.();
      } else {
        toast.error(results.find((r) => r?.message)?.message || t("something_went_wrong"));
      }
    } catch (error: any) {
      console.log("Error", error);
      toast.error(t("something_went_wrong"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent title={t("cancel")}>
        <DialogHeader className="font-bold text-2xl text-start flex flex-row justify-between">
          {t("cancel")}
          <div className="closeButtonBg rounded-full p-[8px] gap-[4px] cursor-pointer">
            <RiCloseFill size={22} onClick={handleHide} />
          </div>
        </DialogHeader>
        <div className="flex flex-col gap-1">
          <label htmlFor="order-cancel-reason" className="font-medium text-base">
            {t("reason")}
            <span className="text-red-500">*</span>
          </label>
          <textarea
            id="order-cancel-reason"
            className="w-full outline-none cardBorder p-2 rounded-sm"
            placeholder={t("write_cancel_reason")}
            onChange={(e) => setReason(e.target.value)}
            value={reason}
          />
        </div>
        <div className="flex justify-end">
          <button
            onClick={handleCancelOrder}
            disabled={loading}
            className="py-1 px-3 primaryBackColor text-white rounded-sm font-normal text-xl disabled:opacity-60"
          >
            {loading ? t("loading") : t("submit")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrderCancelModal;
