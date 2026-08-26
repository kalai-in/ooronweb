import React, { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { t } from "@/utils/translation";
import ActiveOrdersCard from "./ActiveOrdersCard";
import * as api from "@/api/apiRoutes";
import CardSkeleton from "@/components/skeleton/CardSkeleton";
import OrderNotFoundImage from "@/assets/not_found_images/No_Orders.svg";
import NotFound from "../../notfound/NotFound";
import OrderChannelTabs from "./OrderChannelTabs";
import OrderDateFilter from "./OrderDateFilter";
import EcomOrdersList from "./EcomOrdersList";

const ActiveOrders = () => {
  // "quick" = existing Quick Order flow (quick channel only),
  // "ecommerce" = new separate ecom_orders flow.
  // Default the order tab to the header's active shop mode so it matches what the
  // user picked up top: header "Quick" → Quick tab, header "Shop all" → All Shop.
  // ShopMode.mode is "quick" | "allShop" (NOT "ecommerce") — map allShop→ecommerce.
  const shopMode = useSelector((state) => state.ShopMode.mode);
  const availableModes = useSelector((state) => state.ShopMode.availableModes);
  const [activeChannel, setActiveChannel] = useState(
    shopMode === "allShop" ? "ecommerce" : "quick",
  );

  // Keep the tab in sync if the header mode changes while this page is open.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs tab with header shop mode
    setActiveChannel(shopMode === "allShop" ? "ecommerce" : "quick");
  }, [shopMode]);
  const [loading, setLoading] = useState(false);
  const [activeOrders, setActiveOrders] = useState([]);
  const [offset, setOffset] = useState(0);
  const [totalOrders, setTotalOrders] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [dateFilter, setDateFilter] = useState(null);

  const ordersPerPage = 10;

  const handleFetchActiveOrders = async (isLoadMore = false, newOffset) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const response = await api.getOrders({
        limit: ordersPerPage,
        offset: newOffset,
        type: 1,
        orderType: "",
        channel: "quick",
        startDate: dateFilter?.startDate,
        endDate: dateFilter?.endDate,
      });
      if (response.status == 1) {
        if (isLoadMore) {
          setActiveOrders((ord) => [...ord, ...response.data]);
        } else {
          setActiveOrders(response.data);
        }
        setTotalOrders(response.total);
        setHasMore(response.data?.length === ordersPerPage);
        setLoading(false);
        setLoadingMore(false);
      } else {
        setActiveOrders([]);
        setLoading(false);
        setTotalOrders(0);
        setHasMore(false);
        setLoadingMore(false);
      }
    } catch (error) {
      console.log("Error", error);
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets pagination on filter change; not derivable from render
    setOffset(0);
    handleFetchActiveOrders(false, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter]);

  const handleFetchMore = async () => {
    setLoadingMore(true);
    const newOffset = offset + ordersPerPage;
    setOffset(newOffset);
    handleFetchActiveOrders(true, newOffset);
  };

  return (
    <div className="w-full overflow-hidden rounded-lg border border-[var(--border-color)]">
      <OrderChannelTabs
        active={activeChannel}
        onChange={setActiveChannel}
        title={t("active_orders")}
      >
        <OrderDateFilter value={dateFilter} onApply={setDateFilter} />
      </OrderChannelTabs>

      {activeChannel === "ecommerce" ? (
        <EcomOrdersList type={1} dateFilter={dateFilter} />
      ) : (
        <>
          {activeOrders.length === 0 && !loading ? (
            <NotFound image={OrderNotFoundImage} title={t("no_order")} />
          ) : (
            <div className="grid grid-cols-1 items-start gap-3 p-3 lg:grid-cols-2 2xl:grid-cols-3">
              {loading
                ? Array?.from({ length: 6 })?.map((_, index) => (
                    <CardSkeleton height={260} padding="p-2" key={index} />
                  ))
                : activeOrders?.map((order) => (
                    <ActiveOrdersCard
                      order={order}
                      key={order?.id}
                      channel={activeChannel}
                      shopMode={shopMode}
                      availableModes={availableModes}
                      onCancelled={() => handleFetchActiveOrders(false, 0)}
                    />
                  ))}
              {loadingMore
                ? Array?.from({ length: 3 })?.map((_, index) => (
                    <CardSkeleton
                      height={260}
                      padding="p-2"
                      key={`m${index}`}
                    />
                  ))
                : null}
            </div>
          )}
          {hasMore && !loading && (
            <div className="flex justify-center p-4">
              <button
                className="rounded-lg primaryBackColor py-2.5 px-6 text-white text-base font-medium disabled:opacity-60"
                onClick={handleFetchMore}
                disabled={loadingMore}
              >
                {loadingMore ? t("loading") : t("load_more")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ActiveOrders;
