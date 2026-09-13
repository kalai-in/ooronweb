import React, { useEffect, useState } from "react";
import { t } from "@/utils/translation";
import NotificationCard from "../notifications/NotificationCard";
import * as api from "../../api/apiRoutes";
import NoNotificationImage from "@/assets/empty-state/no-notification.svg";
import CardSkeleton from "../skeleton/CardSkeleton";
import NotFound from "../notfound/NotFound";

interface NotificationsProps {
  selectedTab: string;
  setSelectedTab: (tab: string) => void;
}

const Notifications = ({ selectedTab, setSelectedTab }: NotificationsProps) => {
  const total_notifications_per_page = 7;

  // Notification entries come straight from the getNotifications API response
  // (raw JSON shape) — `any` here matches the API-boundary policy.
  const [notifications, setNotifications] = useState<any[]>([]);
  const [currPage, setCurrPage] = useState(1);
  const [offset, setoffset] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [totalNotications, setTotalNotifications] = useState<number | null>(null);
  const [isError, setIsError] = useState(false);

  const handleFetchNotifications = async (offset = 0) => {
    setIsLoading(true);
    if (offset === 0) {
      setIsError(false);
    }
    try {
      const response = await api.getNotifications({
        limit: total_notifications_per_page,
        offset,
      });
      setTotalNotifications(response.total);
      setNotifications((prev) =>
        offset === 0 ? response.data : [...prev, ...response?.data],
      );
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
      if (offset === 0) {
        setIsError(true);
      }
      console.log("Error ", error);
    }
  };

  useEffect(() => {
    if (selectedTab === "notifications") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-tab-change pattern; not derivable from render
      handleFetchNotifications();
    }
  }, [selectedTab]);

  const handleLoadMore = (pageNum: number) => {
    setCurrPage(pageNum);
    setoffset(
      pageNum * total_notifications_per_page - total_notifications_per_page,
    );
    handleFetchNotifications(
      pageNum * total_notifications_per_page - total_notifications_per_page,
    );
  };

  return (
    <div>
      <div className="cardBorder rounded-xl bg-white dark:bg-zinc-900 shadow-sm overflow-hidden">
        <div className="flex justify-between items-center px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
          <h2 className="font-bold text-lg textColor">{t("notification")}</h2>
        </div>
        <div className="flex flex-col gap-3 p-4">
          {isLoading &&
            Array.from({ length: total_notifications_per_page }).map(
              (_, idx) => (
                <div key={idx} className="w-full">
                  <CardSkeleton height={100} padding="p-1" />
                </div>
              ),
            )}
          {notifications?.length > 0 ? (
            notifications?.map((notification) => (
              <NotificationCard
                notification={notification}
                key={notification?.id}
              />
            ))
          ) : !isLoading && isError ? (
            <div className="grid place-items-center gap-3 py-10 text-center">
              <p className="font-semibold text-base textColor">
                {t("something_went_wrong") || "Something went wrong"}
              </p>
              <button
                className="rounded-lg primaryBackColor py-2 px-5 text-white text-sm font-medium"
                onClick={() => handleFetchNotifications(0)}
              >
                {t("retry") || t("try_again") || "Retry"}
              </button>
            </div>
          ) : (
            !isLoading && (
              <NotFound
                image={NoNotificationImage}
                title={t("empty_notification_list_message")}
                className="col-span-12"
              />
            )
          )}
        </div>

        {(notifications?.length ?? 0) < (totalNotications ?? 0) && (
          <div className="flex justify-center px-4 pb-4">
            <button
              className="rounded-lg primaryBackColor px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 active:scale-95 focus:outline-none disabled:opacity-50"
              onClick={() => handleLoadMore(currPage + 1)}
              disabled={isLoading}
            >
              {t("load_more")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Notifications;
