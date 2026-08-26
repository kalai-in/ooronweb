import React, { useEffect, useState } from "react";
import StatusOne from "@/assets/statusIcons/status_icon_awaiting_payment.svg";
import StatusTwo from "@/assets/statusIcons/status_icon_received.svg";
import StatusThree from "@/assets/statusIcons/status_icon_process.svg";
import StatusFour from "@/assets/statusIcons/status_icon_shipped.svg";
import StatusFive from "@/assets/statusIcons/status_icon_out_for_delivery.svg";
import StatusSix from "@/assets/statusIcons/status_icon_delivered.svg";
import StatusSeven from "@/assets/statusIcons/status_icon_cancel.svg";
import StatusReturned from "@/assets/statusIcons/status_icon_returned.svg";
import Image from "next/image";
import { t } from "@/utils/translation";
import { formatDateTime } from "@/utils/helperFunction";

const OrderStepper = ({ orderDetail }) => {
  const statusMappings = {
    1: { icon: StatusOne, label: t("paymentPending") },
    2: { icon: StatusTwo, label: t("order_status_display_name_recieved") },
    3: { icon: StatusThree, label: t("processed") },
    4: { icon: StatusFour, label: t("shipped") },
    5: { icon: StatusFive, label: t("out_for_delivery") },
    6: { icon: StatusSix, label: t("order_status_display_name_delivered") },
    7: { icon: StatusSeven, label: t("cancelled") },
    8: { icon: StatusReturned, label: t("returned") },
    9: { icon: StatusThree, label: t("order_status_display_name_recieved") },
    10: { icon: StatusTwo, label: t("ready_to_pickup") },
    11: { icon: StatusSix, label: t("picked") },
    // Return / refund pipeline codes use the returned icon.
    12: { icon: StatusReturned, label: t("refund_completed") },
    13: { icon: StatusReturned, label: t("refund_completed") },
  };

  // The return/refund pipeline has many statuses (Return Requested, Accepted,
  // Delivery Boy Assigned, Out for Pickup, Received from Customer, Return to
  // Store, Refund Completed) whose numeric codes aren't all in statusMappings.
  // When the numeric code is unmapped, pick an icon from the localized
  // status_name text so each step still gets a fitting icon (never a broken one).
  const iconFromLabel = (name = "") => {
    const s = name.toLowerCase();
    if (/refund/.test(s)) return StatusSix; // ✓ money back / done
    if (/return|received from customer|to store/.test(s)) return StatusReturned;
    if (/pickup|out for/.test(s)) return StatusFive; // out for delivery/pickup
    if (/assign|delivery boy|partner/.test(s)) return StatusFour; // shipped/assigned
    if (/accept|approve|process/.test(s)) return StatusThree;
    if (/cancel|reject/.test(s)) return StatusSeven;
    if (/deliver|complete/.test(s)) return StatusSix;
    if (/ship/.test(s)) return StatusFour;
    if (/receiv|request|placed/.test(s)) return StatusTwo;
    return StatusSix;
  };

  const [steps, setSteps] = useState([]);

  const handleGetSteps = () => {
    // API returns `timeline`: [{ status, status_name, datetime }]. `status` is the
    // numeric code (drives the icon), `status_name` is the server-localized label.
    //
    // `datetime` arrives in EITHER shape depending on the backend build: a raw SQL
    // timestamp ("2026-08-03 04:49:22") or an already-formatted display string
    // ("26 Jun 2026 11:44 AM"). Raw ones were rendered verbatim, so the stepper
    // showed a different format from every other date on the page. Normalize the
    // raw shape through formatDateTime (the same country-settings formatter the
    // order cards use) and pass anything already formatted through untouched.
    const displayDate = (value) => {
      if (!value) return "";
      // Matches "YYYY-MM-DD HH:MM(:SS)" / ISO — the raw shapes new Date() parses
      // reliably. A formatted string ("26 Jun 2026 …") is left alone: reparsing
      // it depends on locale and would risk turning a good value into "".
      const isRaw = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(
        String(value).trim(),
      );
      if (!isRaw) return value;
      return formatDateTime(value) || value;
    };

    const updatedSteps = orderDetail?.timeline?.map((entry) => {
      const mapped = statusMappings[entry?.status] || {};
      const label = entry?.status_name || mapped.label || "";
      return {
        // Prefer the numeric-code icon; for unmapped (return/refund) codes fall
        // back to a keyword match on the label so each step has a fitting icon.
        icon: mapped.icon || iconFromLabel(label),
        label: `${t("your_order_has_been")} ${label}`,
        timestamp: displayDate(entry?.datetime),
      };
    });
    setSteps(updatedSteps || []);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- derives steps from orderDetail prop
    handleGetSteps();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleGetSteps is a plain closure, re-run only on orderDetail change
  }, [orderDetail]);

  return (
    <div className="rounded-lg border border-[var(--border-color)] p-5">
      {steps?.map((status, index) => (
        <div
          key={index}
          className="relative flex items-start gap-4 pb-8 last:pb-0"
        >
          {/* Icon + connector */}
          <div className="relative shrink-0">
            <div className="flex h-11 w-11 items-center justify-center rounded-full primaryBackColor ring-4 ring-[color-mix(in_srgb,var(--primary-color)_18%,transparent)]">
              <Image
                src={status?.icon?.src}
                alt="icon"
                height={22}
                width={22}
                className="h-3/5 w-auto"
              />
            </div>
            {index < steps.length - 1 && (
              <div className="absolute left-1/2 top-11 h-[calc(100%-1rem)] w-0.5 -translate-x-1/2 primaryBackColor" />
            )}
          </div>

          {/* Text */}
          <div className="flex-1 pt-1.5">
            <p className="font-semibold text-sm">{status.label}</p>
            <p className="mt-0.5 text-xs SecondaryTextColor">
              {status.timestamp}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default OrderStepper;
