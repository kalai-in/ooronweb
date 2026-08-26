import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setSelectedAddresForEdit } from "@/redux/slices/addressSlice";
import { setAddress } from "@/redux/slices/checkoutSlice";
import * as api from "@/api/apiRoutes";
import { Dialog, DialogContent, DialogOverlay } from "@/components/ui/dialog";
import { FaRegEdit } from "react-icons/fa";
import { RiDeleteBinLine } from "react-icons/ri";
import { TbAlertTriangle } from "react-icons/tb";
import { LuHouse, LuBriefcase, LuMapPin, LuPhone, LuCheck } from "react-icons/lu";
import { t } from "@/utils/translation";

const AddressCard = ({
  address,
  setShowAddAddres,
  setIsAddressSelected,
  fetchAddress,
  finalOrderAddress,
  fromAddress,
}) => {
  const dispatch = useDispatch();

  const checkout = useSelector((state) => state.Checkout);

  const theme = useSelector((state) => state.Theme.theme);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const formattedAddress = `${address?.address}, ${address?.landmark}, ${address?.area}, ${address?.city}, ${address?.state}, ${address?.pincode}-${address?.country}`;

  const handleDeleteAdress = async () => {
    try {
      setDeleting(true);
      const response = await api.deleteAddress({ id: address.id });
      if (response.status === 1) {
        fetchAddress();
        dispatch(setSelectedAddresForEdit({ data: null }));
        setShowDeleteModal(false);
      }
    } catch (error) {
      console.log("error", error);
    } finally {
      setDeleting(false);
    }
  };

  const handleEditAddress = () => {
    setShowAddAddres(true);
    setIsAddressSelected(true);
    dispatch(setSelectedAddresForEdit({ data: address }));
  };

  const handleCheckboxChange = () => {
    dispatch(setAddress({ data: address }));
  };

  const isSelected = checkout?.address?.id === address?.id;
  const selectable = !fromAddress && !finalOrderAddress;

  // Icon by address type (home / work / other).
  const typeKey = String(address?.type || "").toLowerCase();
  const TYPE_ICONS = { home: LuHouse, work: LuBriefcase, office: LuBriefcase };
  const TypeIcon = TYPE_ICONS[typeKey] || LuMapPin;

  return (
    <div>
      <div
        role={selectable ? "button" : undefined}
        tabIndex={selectable ? 0 : undefined}
        onClick={selectable ? handleCheckboxChange : undefined}
        onKeyDown={
          selectable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleCheckboxChange();
                }
              }
            : undefined
        }
        className={`group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-white dark:bg-zinc-900 transition-all duration-200 ${
          selectable ? "cursor-pointer" : ""
        } ${
          isSelected
            ? "border-[var(--primary-color)] ring-2 ring-[color-mix(in_srgb,var(--primary-color)_20%,transparent)] shadow-lg shadow-[color-mix(in_srgb,var(--primary-color)_8%,transparent)]"
            : "border-slate-200 dark:border-zinc-800 "
        }`}
      >
        {/* selected accent bar on top */}
        {selectable && isSelected && (
          <span className="absolute inset-x-0 top-0 h-1 primaryBackColor" />
        )}

        <div className="flex flex-col gap-4 p-4 sm:p-5">
          {/* header: type icon + name + tags + select check */}
          <div className="flex items-start gap-3">
            <span
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors ${
                isSelected
                  ? "primaryBackColor text-white"
                  : "primaryLightBack primaryColor"
              }`}
            >
              <TypeIcon size={22} />
            </span>
            <div className="min-w-0 flex-grow">
              <h2 className="font-extrabold text-lg sm:text-xl textColor truncate leading-tight capitalize">
                {address?.name}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                {address?.type && (
                  <span className="shrink-0 inline-flex items-center gap-1 font-semibold capitalize SecondaryTextColor">
                    {address?.type}
                  </span>
                )}
                {address?.type &&
                  address?.is_default === 1 &&
                  !finalOrderAddress && (
                    <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-zinc-600" />
                  )}
                {address?.is_default === 1 && !finalOrderAddress && (
                  <span className="shrink-0 inline-flex items-center gap-1 font-bold uppercase tracking-wide primaryColor">
                    <LuCheck size={12} strokeWidth={3.5} />
                    {t("default")}
                  </span>
                )}
              </div>
            </div>
            {selectable && (
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-all ${
                  isSelected
                    ? "primaryBackColor border-[var(--primary-color)] text-white scale-100"
                    : "border-slate-300 dark:border-zinc-600 text-transparent"
                }`}
              >
                <LuCheck size={13} strokeWidth={3} />
              </span>
            )}
          </div>

          {/* address body */}
          <p className="text-sm leading-relaxed textColor/90">
            {formattedAddress}
          </p>

          {/* full-width divider */}
          <div className="-mx-4 sm:-mx-5 border-t border-dashed border-slate-200 dark:border-zinc-800" />

          {/* footer: phone + actions */}
          <div className="flex items-center justify-between gap-2">
            <p className="inline-flex min-w-0 items-center gap-2 truncate text-sm font-bold textColor">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full primaryLightBack primaryColor">
                <LuPhone size={13} />
              </span>
              {address?.country_code ? `${address.country_code} ` : ""}
              {address?.mobile}
            </p>
            {!finalOrderAddress && (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  aria-label={t("edit")}
                  className="flex items-center gap-1.5 rounded-xl primaryLightBack px-3.5 py-2 text-sm font-bold primaryColor transition hover:opacity-85 active:scale-95"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditAddress();
                  }}
                >
                  <FaRegEdit size={14} />
                  <span className="hidden sm:inline">{t("edit")}</span>
                </button>
                <button
                  type="button"
                  aria-label={t("delete")}
                  className="flex items-center gap-1.5 rounded-xl bg-red-50 dark:bg-red-950/30 px-3.5 py-2 text-sm font-bold text-red-600 transition hover:bg-red-100 dark:hover:bg-red-950/50 active:scale-95"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteModal(true);
                  }}
                >
                  <RiDeleteBinLine size={14} />
                  <span className="hidden sm:inline">{t("delete")}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <Dialog open={showDeleteModal}>
        <DialogOverlay
          className={`${theme === "light" ? "bg-white/80" : "bg-black/80"}`}
        />
        <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden" title={t("delete_address")}>
          <div className="flex flex-col items-center px-6 pt-7 pb-6 text-center">
            {/* warning icon */}
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/40">
              <TbAlertTriangle size={28} className="text-red-600" />
            </div>

            <h2 className="mt-4 text-lg font-bold textColor">
              {t("delete_address")}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed SecondaryTextColor">
              {t("delete_address_message")}
            </p>

            {/* address preview so user confirms the right one */}
            <div className="mt-4 w-full rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/50 px-4 py-3 text-left">
              <p className="text-sm font-semibold textColor truncate">
                {address?.name}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed SecondaryTextColor line-clamp-2">
                {formattedAddress}
              </p>
            </div>

            {/* actions — destructive primary, neutral cancel */}
            <div className="mt-6 flex w-full gap-3">
              <button
                type="button"
                className="flex-1 rounded-lg border border-slate-200 dark:border-zinc-700 py-2.5 text-sm font-semibold textColor hover:bg-slate-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                onClick={() => setShowDeleteModal(false)}
                disabled={deleting}
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700 transition-colors disabled:opacity-60"
                onClick={handleDeleteAdress}
                disabled={deleting}
              >
                {deleting ? (
                  t("loading")
                ) : (
                  <>
                    <RiDeleteBinLine size={16} />
                    {t("delete")}
                  </>
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AddressCard;
