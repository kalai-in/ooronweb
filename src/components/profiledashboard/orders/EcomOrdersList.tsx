import React, { useEffect, useState, useRef } from "react";
import { useSelector } from "react-redux";
import { t } from "@/utils/translation";
import * as api from "@/api/apiRoutes";
import EcomOrdersCard from "./EcomOrdersCard";
import CardSkeleton from "@/components/skeleton/CardSkeleton";
import OrderNotFoundImage from "@/assets/not_found_images/No_Orders.svg";
import NotFound from "../../notfound/NotFound";
import type { OrderDateFilterValue } from "./OrderDateFilter";

// Shared list for both E-commerce active (type=1) and history (type=0) tabs.
// Uses the dedicated getEcomOrders API only — never touches the Quick Order
// getOrders flow. Rows are per-order-item. `dateFilter` ({startDate,endDate}) is
// owned by the parent so the date range control lives in the shared tab header.
const ECOM_ORDERS_PER_PAGE = 10;

interface EcomOrdersListProps {
  type: number;
  dateFilter?: OrderDateFilterValue | null;
}

const EcomOrdersList = ({ type, dateFilter }: EcomOrdersListProps) => {
  const shopMode = useSelector((state: any) => state.ShopMode.mode);
  const availableModes = useSelector((state: any) => state.ShopMode.availableModes);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState<number | null>(null);
  const [isError, setIsError] = useState(false);

  const handleFetch = async (isLoadMore = false, newOffset = 0) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setIsError(false);
    }
    try {
      const response = await api.getEcomOrders({
        limit: ECOM_ORDERS_PER_PAGE,
        offset: newOffset,
        type,
        startDate: dateFilter?.startDate,
        endDate: dateFilter?.endDate,
      });
      if (response?.status == 1) {
        const data = response?.data || [];
        setOrders((prev) => (isLoadMore ? [...prev, ...data] : data));
        setTotal(response?.total ?? data.length);
      } else if (!isLoadMore) {
        setOrders([]);
        setTotal(0);
      }
    } catch (error: any) {
      console.log("Error", error);
      if (!isLoadMore) {
        setOrders([]);
        setIsError(true);
      }
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Guards against React StrictMode's dev-only double-invoke of this effect
  // firing handleFetch() twice for the same [type, dateFilter] — a ref (not
  // state) so the write is synchronous and visible to the phantom
  // mount→cleanup→remount cycle, same pattern as EcomOrderDetail.tsx's
  // fetchedOrderItemIdRef / CartDrawer's openFetchedRef. Keyed on a
  // serialized composite since this effect has two dependencies.
  const fetchedKeyRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    const key = `${type}:${dateFilter?.startDate ?? ""}:${dateFilter?.endDate ?? ""}`;
    if (fetchedKeyRef.current === key) return;
    fetchedKeyRef.current = key;
    setOffset(0);
    handleFetch(false, 0);
    // re-fetch when switching between active/history or changing date range
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, dateFilter]);

  const handleFetchMore = () => {
    const newOffset = offset + ECOM_ORDERS_PER_PAGE;
    setOffset(newOffset);
    handleFetch(true, newOffset);
  };

  const hasMore = total != null && orders.length < total;

  return (
    <>
      {isError && !loading ? (
        <div className="grid place-items-center gap-3 p-10 text-center">
          <p className="font-semibold text-base">{t("something_went_wrong")}</p>
          <button
            className="rounded-lg primaryBackColor py-2 px-5 text-white text-sm font-medium"
            onClick={() => handleFetch(false, 0)}
          >
            {t("retry") || t("try_again") || "Retry"}
          </button>
        </div>
      ) : orders.length === 0 && !loading ? (
        <NotFound image={OrderNotFoundImage} title={t("no_order")} />
      ) : (
        <div className="grid grid-cols-1 items-start gap-3 p-3 lg:grid-cols-2 2xl:grid-cols-3">
          {loading
            ? Array.from({ length: 6 }).map((_, index) => (
                <CardSkeleton height={230} padding="p-2" key={index} />
              ))
            : orders.map((order) => (
                <EcomOrdersCard
                  order={order}
                  key={order?.id}
                  channel="ecommerce"
                  shopMode={shopMode}
                  availableModes={availableModes}
                  onCancelled={() => handleFetch(false, 0)}
                />
              ))}
          {loadingMore
            ? Array.from({ length: 3 }).map((_, index) => (
                <CardSkeleton height={230} padding="p-2" key={`m${index}`} />
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
  );
};

export default EcomOrdersList;
