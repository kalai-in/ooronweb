import React, { useEffect, useState } from "react";
import { t } from "@/utils/translation";
import * as api from "@/api/apiRoutes";
import { Switch } from "@/components/ui/switch";
import Loader from "@/components/loader/Loader";
import { toast } from "react-toastify";
import {
  HiOutlineMail,
  HiOutlineBell,
  HiOutlineChatAlt2,
} from "react-icons/hi";
import useDir from "@/hooks/useDir";
import NotFound from "@/components/notfound/NotFound";
import NoNotificationImage from "@/assets/empty-state/no-notification.svg";

// Channel presentation. The API decides WHICH channels each event supports
// (chat_message is push-only, otp is sms-only), so this map only supplies the
// label and icon — never the list of toggles to render.
const CHANNEL_META = {
  mail: { icon: HiOutlineMail, labelKey: "email", fallback: "Email" },
  push: {
    icon: HiOutlineBell,
    labelKey: "push_notification",
    fallback: "Push Notification",
  },
  sms: { icon: HiOutlineChatAlt2, labelKey: "sms", fallback: "SMS" },
};

// "order_status_out_for_delivery" → "Out For Delivery". Only a fallback — the
// API sends a `label` for every event today.
const humanize = (key = "") =>
  key
    .replace(/^order_status_/, "")
    .replace(/^return_status_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const NotificationSetting = () => {
  const dir = useDir();
  // Held in the API's own shape: [{ category, events: [{key,label,channels}] }].
  // Save flattens it back out, so the grouping never has to round-trip.
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleGetPreferences = async () => {
    setLoading(true);
    try {
      const res: any = await api.getNotificationPreferences();
      const list = Array.isArray(res?.data) ? res.data : [];
      setCategories(list);
    } catch (error) {
      console.log("error", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount pattern; not derivable from render
    handleGetPreferences();
  }, []);

  const handleToggle = (categoryName: string, key: string, channel: string, checked: boolean) => {
    setCategories((prev) =>
      prev.map((cat) =>
        cat.category !== categoryName
          ? cat
          : {
              ...cat,
              events: cat.events.map((event: any) =>
                event.key === key
                  ? {
                      ...event,
                      channels: { ...event.channels, [channel]: checked },
                    }
                  : event,
              ),
            },
      ),
    );
  };

  const handleUpdatePreferences = async () => {
    setSubmitting(true);
    try {
      // Flatten categories away — save takes a bare event list. Channels go
      // back with exactly the keys they arrived with; the channel SET belongs
      // to the backend, only the booleans are the user's to change.
      const payload = categories.flatMap((cat) =>
        (cat?.events ?? []).map((event: any) => ({
          key: event.key,
          channels: Object.fromEntries(
            Object.keys(event?.channels ?? {}).map((c) => [
              c,
              Boolean(event.channels[c]),
            ]),
          ),
        })),
      );
      const res: any = await api.updateNotificationPreferences({
        preferences: payload,
      });
      // Server sends its own copy ("Notification preferences saved") — show it
      // so the toast tracks the API rather than a second, drifting local string.
      if (res?.status == 1) {
        toast.success(res?.message || t("notification_setting_success"));
      } else {
        toast.error(res?.message);
      }
    } catch (error) {
      console.log("error", error);
    } finally {
      setSubmitting(false);
    }
  };

  const hasEvents = categories?.some((cat) => cat?.events?.length > 0);

  return loading ? (
    <Loader />
  ) : (
    <div
      dir={dir}
      className="cardBorder rounded-xl bg-white dark:bg-zinc-900 shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
        <h2 className="font-bold text-lg textColor">
          {t("notification_setting")}
        </h2>
      </div>

      <div className="p-4 sm:p-5">
        {!hasEvents ? (
          <div className="py-6">
            <NotFound
              image={NoNotificationImage}
              title={t("no_data_found") || "No Data Found"}
              description={
                t("no_notification_settings_found") ||
                "No notification settings are available right now."
              }
            />
          </div>
        ) : (
          <>
            <p className="mb-5 text-[13px] SecondaryTextColor">
              {t("choose_how_you_want_to_be_notified") ||
                "Choose how you want to be notified for each event."}
            </p>

            <div className="flex flex-col gap-6">
              {categories?.map((cat) =>
                !cat?.events?.length ? null : (
                  <section key={cat.category}>
                    <h3 className="mb-2 text-xs font-bold uppercase tracking-wide SecondaryTextColor">
                      {cat.category}
                    </h3>

                    {/* Setting rows — each event carries its own
                                                self-labeled channel toggles, so nothing
                                                depends on column alignment. */}
                    <div className="flex flex-col gap-2">
                      {cat.events.map((event) => (
                        <div
                          key={event?.key}
                          className="flex flex-col gap-3 rounded-xl border cardBorder px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg primaryColor bg-[color-mix(in_srgb,var(--primary-color)_12%,transparent)]">
                              <HiOutlineBell size={16} />
                            </span>
                            <h4 className="min-w-0 truncate font-semibold text-sm textColor">
                              {event?.label || humanize(event?.key)}
                            </h4>
                          </div>

                          {/* Only the channels this event supports. */}
                          <div className="flex shrink-0 flex-wrap items-center gap-2">
                            {Object.keys(event?.channels ?? {}).map(
                              (channel) => {
                                const meta = CHANNEL_META[channel];
                                const Icon = meta?.icon ?? HiOutlineBell;
                                return (
                                  <label
                                    key={channel}
                                    className="flex items-center gap-2 rounded-full border cardBorder bg-gray-50/60 dark:bg-zinc-800/60 px-3 py-1.5 cursor-pointer"
                                  >
                                    <Icon
                                      size={15}
                                      className="SecondaryTextColor"
                                    />
                                    <span className="text-xs font-medium textColor">
                                      {meta
                                        ? t(meta.labelKey) || meta.fallback
                                        : humanize(channel)}
                                    </span>
                                    <Switch
                                      checked={Boolean(event.channels[channel])}
                                      onCheckedChange={(checked) =>
                                        handleToggle(
                                          cat.category,
                                          event.key,
                                          channel,
                                          checked,
                                        )
                                      }
                                    />
                                  </label>
                                );
                              },
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                ),
              )}
            </div>

            {/* Save */}
            <div className="mt-6 flex justify-end border-t border-gray-100 dark:border-zinc-800 pt-4">
              <button
                type="submit"
                className="min-w-[120px] rounded-lg primaryBackColor px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                disabled={submitting}
                onClick={handleUpdatePreferences}
              >
                {submitting ? t("saving") : t("save")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default NotificationSetting;
