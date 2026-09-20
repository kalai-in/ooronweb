import React, { useEffect, useState, useRef } from "react";
import { useSelector } from "react-redux";
import { t } from "@/utils/translation";
import PrevOrderCard from "./PrevOrderCard";
import * as api from "@/api/apiRoutes";
import CardSkeleton from "@/components/skeleton/CardSkeleton";
import OrderNotFoundImage from "@/assets/not_found_images/No_Orders.svg";
import NotFound from "../../notfound/NotFound";
import OrderChannelTabs from "./OrderChannelTabs";
import OrderDateFilter, { type OrderDateFilterValue } from "./OrderDateFilter";
import EcomOrdersList from "./EcomOrdersList";

const PrevOrder = () => {
  // Quick tab is the existing Quick Order flow (quick channel only);
  // ecommerce tab is the separate ecom_orders flow.
  // Default the tab to the header's active shop mode (Quick → Quick, Shop all →
  // All Shop). ShopMode.mode is "quick" | "allShop"; map allShop→ecommerce.
  const shopMode = useSelector((state: any) => state.ShopMode.mode);
  const availableModes = useSelector((state: any) => state.ShopMode.availableModes);
  const [activeChannel, setActiveChannel] = useState<string>(
    shopMode === "allShop" ? "ecommerce" : "quick",
  );

  // Sync if the header mode changes while this page is open.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs tab with header shop mode
    setActiveChannel(shopMode === "allShop" ? "ecommerce" : "quick");
  }, [shopMode]);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);
  const [prevOrders, setPrevOrders] = useState<any[]>([]);
  const [totalOrders, setTotalOrders] = useState<number | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [dateFilter, setDateFilter] = useState<OrderDateFilterValue | null>(null);

  const ordersPerPage = 10;

  const handleFetchPrevOrders = async (isLoadMore = false, newOffset?: number) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    try {
      const response = await api.getOrders({
        limit: ordersPerPage,
        offset: newOffset,
        type: 0,
        channel: "quick",
        startDate: dateFilter?.startDate,
        endDate: dateFilter?.endDate,
      });
      if (response?.status == 1) {
        if (isLoadMore) {
          setPrevOrders((ord) => [...ord, ...response?.data]);
        } else {
          setPrevOrders(response?.data);
        }
        setTotalOrders(response.total);
        setLoading(false);
        setLoadingMore(false);
      } else {
        setLoading(false);
        setPrevOrders([]);
        setLoadingMore(false);
      }
    } catch (error: any) {
      setLoading(false);
      setLoadingMore(false);
      console.log("Error", error);
    }
  };

  // Guards against React StrictMode's dev-only double-invoke of this effect
  // firing handleFetchPrevOrders() twice for the same dateFilter — a ref
  // (not state) so the write is synchronous and visible to the phantom
  // mount→cleanup→remount cycle, same pattern as EcomOrderDetail.tsx's
  // fetchedOrderItemIdRef / CartDrawer's openFetchedRef.
  const fetchedDateFilterRef = useRef<OrderDateFilterValue | null | undefined>(
    undefined,
  );

  useEffect(() => {
    if (fetchedDateFilterRef.current === dateFilter) return;
    fetchedDateFilterRef.current = dateFilter;
    setOffset(0);
    handleFetchPrevOrders(false, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFilter]);

  const handleFetchMore = async () => {
    const newOffset = offset + ordersPerPage;
    setOffset(newOffset);
    handleFetchPrevOrders(true, newOffset);
  };

  return (
    <div className="w-full cardBorder rounded-sm ">
      <OrderChannelTabs
        active={activeChannel}
        onChange={setActiveChannel}
        title={t("order_history")}
      >
        <OrderDateFilter value={dateFilter} onApply={setDateFilter} />
      </OrderChannelTabs>

      {activeChannel === "ecommerce" ? (
        <EcomOrdersList type={0} dateFilter={dateFilter} />
      ) : (
        <>
          {prevOrders?.length == 0 && !loading ? (
            <NotFound image={OrderNotFoundImage} title={t("no_order")} />
          ) : (
            <div className="grid grid-cols-1 items-start gap-3 p-3 lg:grid-cols-2 2xl:grid-cols-3">
              {loading
                ? Array.from({ length: 6 })?.map((_, index) => (
                    <CardSkeleton height={260} padding="p-2" key={index} />
                  ))
                : prevOrders?.map((order) => (
                    <PrevOrderCard
                      order={order}
                      key={order?.id}
                      channel={activeChannel}
                      shopMode={shopMode}
                      availableModes={availableModes}
                      onCancelled={() => handleFetchPrevOrders(false, 0)}
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
          {(totalOrders as number) > prevOrders?.length && (
            <div className="flex justify-center p-4">
              <button
                className="bg-[#29363f] py-2 px-4 text-white rounded-sm text-lg font-normal"
                onClick={handleFetchMore}
              >
                {t("load_more")}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default PrevOrder;
