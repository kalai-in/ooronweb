import React, { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { RiCloseFill, RiArrowGoBackLine } from "react-icons/ri";
import { FiMapPin, FiHome, FiBriefcase } from "react-icons/fi";
import { t } from "@/utils/translation";
import { toast } from "react-toastify";
import * as api from "@/api/apiRoutes";
import ImageWithPlaceholder from "../image-with-placeholder/ImageWithPlaceholder";

interface ReturnReasonModalProps {
  showReturnModal: boolean;
  setShowReturnModal: (show: boolean) => void;
  // Order-item row the return targets; shape varies by order type (Quick vs
  // Ecom) and has no shared type yet — see AGENTS.md rule 4.
  selectedProduct: any;
  handleFetchOrderDetail: () => Promise<void> | void;
}

const ReturnReasonModal = ({
  showReturnModal,
  setShowReturnModal,
  selectedProduct,
  handleFetchOrderDetail,
}: ReturnReasonModalProps) => {
  const [returnReason, setReturnReason] = useState("");
  const [loading, setLoading] = useState(false);
  // Pickup address selection — same flow as checkout. The return now needs an
  // address_id (where the courier collects the item).
  const [addresses, setAddresses] = useState<any[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | string | null>(null);
  const [addressLoading, setAddressLoading] = useState(false);

  // Load the user's saved addresses when the modal opens; preselect the default.
  useEffect(() => {
    if (!showReturnModal) return;
    let active = true;
    (async () => {
      setAddressLoading(true);
      try {
        const res = await api.getAddress();
        if (!active) return;
        if (res?.status == 1) {
          const list = res?.data || [];
          setAddresses(list);
          const def = list.find((a: any) => a?.is_default == 1) || list[0];
          setSelectedAddressId(def?.id ?? null);
        } else {
          setAddresses([]);
        }
      } catch (error) {
        console.log("Error", error);
      } finally {
        if (active) setAddressLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [showReturnModal]);

  const handleHideReturnModal = () => {
    setShowReturnModal(false);
    setReturnReason("");
  };

  const handleProductReturn = async () => {
    if (!returnReason.trim()) {
      toast.error(t("reason_is_required"));
      return;
    }
    if (!selectedAddressId) {
      toast.error(t("please_select_address"));
      return;
    }
    setLoading(true);
    try {
      const response = await api.changeOrderStatus({
        orderId: selectedProduct?.order_id,
        orderItemId: selectedProduct?.id,
        status: 8,
        returnReason: returnReason,
        addressId: selectedAddressId,
      });
      if (response?.status == 1) {
        setReturnReason("");
        setLoading(false);
        toast.success(response.message);
        await handleFetchOrderDetail();
        setShowReturnModal(false);
      } else {
        toast.error(response.message);
        setLoading(false);
      }
    } catch (error: any) {
      // Surface the backend error so a 500 doesn't fail silently.
      console.log("Return error", error?.response?.status, error?.response?.data);
      toast.error(
        error?.response?.data?.message || t("something_went_wrong")
      );
      setLoading(false);
    }
  };

  const productName = selectedProduct?.product_name || selectedProduct?.name;
  const MAX = 300;

  const formatAddress = (a: any) =>
    [a?.address, a?.area, a?.city, a?.state, a?.pincode, a?.country]
      .filter(Boolean)
      .join(", ");

  const typeIcon = (type: string | undefined) => {
    const tt = (type || "").toLowerCase();
    if (tt === "home") return FiHome;
    if (tt === "work" || tt === "office") return FiBriefcase;
    return FiMapPin;
  };

  return (
    <Dialog open={showReturnModal} onOpenChange={setShowReturnModal}>
      <DialogContent
        className="w-[calc(100vw-2rem)] !p-0 overflow-hidden gap-0 rounded-2xl border-0 sm:w-full sm:max-w-[420px]"
        title={t("return")}
      >
        {/* Single grid child wrapper — grid items default to min-width:auto, so a
            wide address line would force the whole dialog wider than max-w and
            overflow. min-w-0 lets it shrink and the inner truncations work. */}
        <div className="w-full min-w-0">
        {/* Hero header — soft primary wash, centered icon + title */}
        <div className="relative px-6 pb-4 pt-6 text-center">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(180deg, color-mix(in srgb, var(--primary-color) 12%, transparent), transparent)",
            }}
          />
          <button
            type="button"
            onClick={handleHideReturnModal}
            aria-label={t("close")}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-gray-500 transition hover:bg-black/10 dark:bg-white/10 dark:text-zinc-300"
          >
            <RiCloseFill size={20} />
          </button>
          <div className="relative mx-auto mb-2.5 flex h-12 w-12 items-center justify-center rounded-2xl primaryBackColor text-white shadow-lg shadow-[var(--primary-color)]/30">
            <RiArrowGoBackLine size={22} />
          </div>
          <h2 className="relative text-lg font-extrabold textColor">
            {t("request_a_return")}
          </h2>
          <p className="relative mt-1 text-xs SecondaryTextColor">
            {t("write_return_reason")}
          </p>
        </div>

        <div className="flex flex-col gap-3.5 px-6 pb-2">
          {/* Product context */}
          {productName && (
            <div className="flex items-center gap-3 rounded-xl border cardBorder p-2.5">
              <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-gray-50 dark:bg-zinc-800">
                <ImageWithPlaceholder
                  src={selectedProduct?.image}
                  alt={productName}
                  fill
                  sizes="48px"
                  className="object-contain p-1"
                />
              </div>
              <p className="min-w-0 flex-grow text-sm font-semibold textColor line-clamp-2">
                {productName}
              </p>
            </div>
          )}

          {/* Pickup address — compact selectable rows (checkout flow). */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold textColor">
              {t("pickup_address") || t("delivery_address")}
              <span className="text-red-500"> *</span>
            </label>
            {addressLoading ? (
              <p className="text-xs SecondaryTextColor py-2">{t("loading")}…</p>
            ) : addresses.length === 0 ? (
              <p className="rounded-xl border border-dashed cardBorder px-3 py-3 text-xs SecondaryTextColor">
                {t("no_address_found") || t("no_data_found")}
              </p>
            ) : (
              <div
                className={`flex flex-col gap-2 ${
                  addresses.length > 3
                    ? "max-h-[210px] overflow-y-auto no-scrollbar"
                    : ""
                }`}
              >
                {addresses.map((addr: any) => {
                  const active = selectedAddressId === addr?.id;
                  const Icon = typeIcon(addr?.type);
                  return (
                    <button
                      key={addr?.id}
                      type="button"
                      onClick={() => setSelectedAddressId(addr?.id)}
                      className={`group flex w-full min-w-0 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                        active
                          ? "primaryColorBorder primaryLightBack dark:border-white dark:bg-white/5"
                          : "cardBorder hover:border-gray-300 dark:hover:border-gray-600"
                      }`}
                    >
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition ${
                          active
                            ? "primaryBackColor text-white"
                            : "primaryLightBack primaryColor dark:text-white"
                        }`}
                      >
                        <Icon size={16} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="text-sm font-bold truncate capitalize">
                            {addr?.type || addr?.name}
                          </span>
                          {addr?.is_default == 1 && (
                            <span className="shrink-0 rounded-full primaryLightBack primaryColor dark:text-white px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide">
                              {t("default")}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-xs SecondaryTextColor truncate">
                          {formatAddress(addr)}
                        </span>
                      </span>
                      <span
                        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition ${
                          active
                            ? "primaryColorBorder dark:border-white"
                            : "border-gray-300 dark:border-gray-600 group-hover:border-gray-400"
                        }`}
                      >
                        {active && (
                          <span className="h-2 w-2 rounded-full primaryBackColor dark:bg-white" />
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Reason field */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="return-reason" className="text-sm font-semibold textColor">
              {t("reason")}
              <span className="text-red-500"> *</span>
            </label>
            <div className="relative">
              <textarea
                id="return-reason"
                rows={3}
                maxLength={MAX}
                className="w-full resize-none rounded-xl border cardBorder bg-transparent p-3 pb-7 text-sm leading-relaxed outline-none transition focus:primaryColorBorder focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary-color)_25%,transparent)]"
                placeholder={t("write_return_reason")}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReturnReason(e.target.value)}
                value={returnReason}
              />
              <span className="pointer-events-none absolute bottom-2.5 right-3 text-[11px] SecondaryTextColor">
                {returnReason.length}/{MAX}
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-6 pb-6 pt-3">
          <button
            type="button"
            onClick={handleHideReturnModal}
            className="cardBorder textColor flex-1 rounded-xl border py-2.5 text-sm font-semibold transition hover:bg-gray-50 dark:hover:bg-zinc-800"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={handleProductReturn}
            disabled={loading || !returnReason.trim() || !selectedAddressId}
            className="primaryBackColor inline-flex flex-[1.4] items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
          >
            {loading && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            {t("submit")}
          </button>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReturnReasonModal;
