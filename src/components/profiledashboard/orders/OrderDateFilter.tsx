import React, { useState } from "react";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import { t } from "@/utils/translation";
import { LuCalendarDays, LuX } from "react-icons/lu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import useIsRtl from "@/hooks/useIsRtl";

// Shared start_date/end_date range filter for order lists. Emits YYYY-MM-DD
// strings via onApply({ startDate, endDate }); onApply(null) clears.
export interface OrderDateFilterValue {
  startDate: string;
  endDate: string;
}

interface OrderDateFilterProps {
  value: OrderDateFilterValue | null;
  onApply: (value: OrderDateFilterValue | null) => void;
}

const OrderDateFilter = ({ value, onApply }: OrderDateFilterProps) => {
  const rtl = useIsRtl();
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>(undefined);

  const hasValue = value?.startDate && value?.endDate;

  // Compact "12 Jun – 18 Jun" label from the YYYY-MM-DD values.
  const pretty = (d: string) => {
    try {
      return format(new Date(d), "dd MMM");
    } catch {
      return d;
    }
  };
  const label = hasValue
    ? `${pretty(value.startDate)} – ${pretty(value.endDate)}`
    : t("date_range") || "Date range";

  const handleApply = () => {
    if (range?.from && range?.to) {
      onApply({
        startDate: format(range.from, "yyyy-MM-dd"),
        endDate: format(range.to, "yyyy-MM-dd"),
      });
      setOpen(false);
    }
  };

  const handleClear = (e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation();
    setRange(undefined);
    onApply(null);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`relative flex items-center gap-1.5 pb-1 text-sm transition-colors ${
            hasValue
              ? "primaryColor font-semibold"
              : "SecondaryTextColor hover:textColor font-medium"
          }`}
        >
          <LuCalendarDays size={15} className="shrink-0" />
          <span className="truncate max-w-[160px]">{label}</span>
          {hasValue && (
            <span
              role="button"
              tabIndex={0}
              aria-label={t("clear") || "Clear"}
              className="ms-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/10 transition-colors hover:bg-black/20"
              onClick={handleClear}
            >
              <LuX size={11} />
            </span>
          )}
          <span
            className={`absolute inset-x-0 -bottom-px h-0.5 rounded-full primaryBackColor transition-all duration-300 ${
              hasValue ? "opacity-100 scale-x-100" : "opacity-0 scale-x-50"
            }`}
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-auto overflow-hidden rounded-2xl border-[var(--border-color)] p-0 shadow-xl"
      >
        {/* Header: title + live selected range */}
        <div className="flex items-center gap-2.5 border-b border-[var(--border-color)] px-4 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg primaryLightBack primaryColor">
            <LuCalendarDays size={16} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">
              {t("select_date_range") || "Select date range"}
            </p>
            <p className="text-xs SecondaryTextColor leading-tight mt-0.5">
              {range?.from
                ? `${format(range.from, "dd MMM yyyy")}${
                    range?.to ? ` – ${format(range.to, "dd MMM yyyy")}` : ""
                  }`
                : t("pick_start_and_end") || "Pick a start and end date"}
            </p>
          </div>
        </div>

        <Calendar
          mode="range"
          dir={rtl ? "rtl" : "ltr"}
          selected={range}
          onSelect={setRange}
          numberOfMonths={1}
          initialFocus
          className="p-3"
          classNames={{
            day_selected:
              "primaryBackColor text-white hover:primaryBackColor hover:text-white focus:primaryBackColor focus:text-white rounded-md",
            day_range_start: "day-range-start rounded-l-md",
            day_range_end: "day-range-end rounded-r-md",
            day_range_middle: "primaryLightBack primaryColor rounded-none",
            day_today: "primaryColor font-bold",
          }}
        />

        <div className="flex items-center justify-between gap-2 border-t border-[var(--border-color)] p-3">
          <button
            type="button"
            onClick={handleClear}
            className="rounded-lg px-3 py-1.5 text-sm font-medium SecondaryTextColor transition-colors hover:bg-black/5 hover:textColor"
          >
            {t("clear") || "Clear"}
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!range?.from || !range?.to}
            className="rounded-lg primaryBackColor px-5 py-1.5 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            {t("apply") || "Apply"}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default OrderDateFilter;
