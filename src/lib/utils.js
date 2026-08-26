import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { store } from "@/redux/store";
import { formatDate, formatDateTime, sanitizeDate } from "@/utils/helperFunction";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatCustomDate(dateString) {
  if (!dateString) return;
  return formatDateTime(sanitizeDate(dateString));
}

export const formatOnlyDate = (dateString) => {
  if (!dateString) return;
  return formatDate(sanitizeDate(dateString));
};

export const isRtl = () => {
  const state = store.getState();
  const isLangRtl =
    state?.Language?.selectedLanguage?.type == "RTL" ? true : false;
  return isLangRtl;
};
