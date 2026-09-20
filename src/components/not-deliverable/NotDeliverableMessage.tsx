import type React from "react";
import { t } from "@/utils/translation";
import { MdLocationOff } from "react-icons/md";

interface NotDeliverableMessageProps {
  message?: React.ReactNode;
  onActionClick?: () => void;
  actionLabel?: string;
}

const NotDeliverableMessage = ({
  message,
  onActionClick,
  actionLabel,
}: NotDeliverableMessageProps) => {
  return (
    <div className="flex min-h-[60vh] w-full items-center justify-center p-8">
      <div className="flex flex-col items-center gap-5 text-center">
        <div className="primaryBackColor rounded-full p-5 text-white shadow-lg">
          <MdLocationOff className="text-white size-6 md:size-10" />
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-base sm:text-lg md:text-2xl font-bold">
            {t("address_not_deliverable")}
          </h1>
          <p className="text-sm md:text-base opacity-60">{message}</p>
        </div>

        {onActionClick && (
          <button
            className="primaryBackColor mt-1 rounded-md px-8 py-2.5 font-bold text-white transition-opacity hover:opacity-90"
            onClick={onActionClick}
          >
            {actionLabel || t("change_location") || "Change Location"}
          </button>
        )}
      </div>
    </div>
  );
};

export default NotDeliverableMessage;
