import React from "react";
import { FiShield, FiX } from "react-icons/fi";
import { Dialog, DialogContent, DialogOverlay } from "@/components/ui/dialog";
import { t } from "@/utils/translation";
import { useSelector } from "react-redux";
import ResetPassword from "./ResetPassword";

/**
 * Change-password modal launched from the profile card.
 *
 * Deliberately thin: it owns only the dialog chrome and delegates the whole form
 * to <ResetPassword embedded /> so the standalone page and this modal can never
 * drift apart in validation or submit behaviour.
 *
 * @param {boolean}  showResetPassword
 * @param {Function} setShowResetPassword
 */
const ResetPasswordModal = ({ showResetPassword, setShowResetPassword }) => {
  const theme = useSelector((state) => state.Theme.theme);
  const close = () => setShowResetPassword(false);

  return (
    <Dialog open={showResetPassword} onOpenChange={setShowResetPassword}>
      <DialogOverlay
        className={`${theme == "light" ? "bg-white/80" : "bg-black/80"}`}
      />
      <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden" title={t("resetPassword")}>
        {/* Header — same soft primary tint as the profile card's hero. */}
        <div className="flex items-start gap-3 px-6 py-5 bg-[color-mix(in_srgb,var(--primary-color,#29363f)_7%,transparent)]">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg primaryColor bg-[color-mix(in_srgb,var(--primary-color,#29363f)_12%,transparent)]">
            <FiShield size={18} />
          </span>
          <div className="min-w-0 flex-grow">
            <h2 className="text-base font-bold textColor">
              {t("resetPassword")}
            </h2>
            <p className="text-xs subTextColor mt-0.5">
              {t("choose_a_strong_password") ||
                "Choose a strong password you don't use elsewhere"}
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label={t("close") || "Close"}
            className="shrink-0 text-gray-400 hover:textColor transition-colors"
          >
            <FiX size={18} />
          </button>
        </div>

        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
          <ResetPassword embedded onSuccess={close} onCancel={close} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ResetPasswordModal;
