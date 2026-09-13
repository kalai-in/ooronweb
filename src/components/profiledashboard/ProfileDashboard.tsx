"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import BreadCrumb from "../breadcrumb/BreadCrumb";
import ProfileSidebar from "./ProfileSidebar";
import Profile from "./Profile";
import Address from "./Address";
import ActiveOrders from "./orders/ActiveOrders";
import OrderHistory from "./orders/PrevOrder";
import Wishlist from "./Wishlist";
import Subscription from "./subscriptions/Subscriptions";
import { usePathname } from "next/navigation";
import WalletHistory from "./wallet/WalletHistory";
import TransactionHistory from "./transactions/TransactionHistory";
import Notifications from "./Notifications";
import { setCurrentUser } from "@/redux/slices/userSlice";
import * as api from "@/api/apiRoutes";
import { useDispatch, useSelector } from "react-redux";
import ResetPassword from "./ResetPassword";
import AuthGate from "@/components/auth/AuthGate";
import CardSkeleton from "../skeleton/CardSkeleton";
import SupportChat from "@/components/chat/support/SupportChat";
import NotificationSetting from "./notification-setting/NotificationSetting";

const ProfileDashboardInner = () => {
  const dispatch = useDispatch();
  const [selectedTab, setSelectedTab] = useState("profile");
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const city = useSelector((state: any) => state.City.city);

  useEffect(() => {
    const currentTab = (pathname || "").split("/").pop();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs selected tab from route pathname
    setSelectedTab(currentTab || "profile");
  }, [pathname]);

  const getCurrentUser = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.getUser({
        latitude: city?.latitude,
        longitude: city?.longitude,
      });
      dispatch(setCurrentUser({ data: response.data }));
      setLoading(false);
    } catch (error) {
      console.log("error", error);
      setLoading(false);
    }
  }, [city, dispatch]);

  // Guards against React StrictMode's dev-only double-invoke of this mount
  // effect firing getCurrentUser() twice — a ref (not state) so the write is
  // synchronous and visible to the phantom mount→cleanup→remount cycle, same
  // pattern as EcomOrderDetail.tsx's fetchedOrderItemIdRef / CartDrawer's
  // openFetchedRef. Component-scoped (not module-level like Layout.tsx's
  // guard) since every tab switch is a real route navigation that unmounts
  // and remounts this component — each new mount should still fetch fresh.
  const fetchedUserRef = useRef(false);

  useEffect(() => {
    if (fetchedUserRef.current) return;
    fetchedUserRef.current = true;
    getCurrentUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeTab = (pathname || "").split("/").pop();

  return (
    <section>
      <BreadCrumb />
      <div className="container">
        <div className="flex flex-col md:flex-row gap-4 lg:gap-6 mb-5 md:mb-10 mt-2 md:mt-4">
          <div className="hidden md:block w-[230px] lg:w-[300px] xl:w-[340px] shrink-0">
            <ProfileSidebar
              setSelectedTab={setSelectedTab}
              selectedTab={selectedTab}
            />
          </div>

          <div className="flex-1 min-w-0">
            {loading ? (
              <div className="flex flex-col gap-2">
                <CardSkeleton height={50} />
                <CardSkeleton height={800} />
              </div>
            ) : (
              <>
                {activeTab == "profile" && <Profile />}
                {activeTab == "resetpassword" && <ResetPassword />}
                {activeTab == "subscription" && <Subscription />}
                {activeTab == "address" && <Address />}
                {activeTab == "activeorders" && <ActiveOrders />}
                {activeTab == "orderhistory" && <OrderHistory />}
                {activeTab == "wishlist" && <Wishlist />}
                {activeTab == "wallethistory" && <WalletHistory />}
                {activeTab == "transaction" && <TransactionHistory />}
                {activeTab == "notifications" && (
                  <Notifications
                    selectedTab={selectedTab}
                    setSelectedTab={setSelectedTab}
                  />
                )}
                {activeTab == "notification-setting" && <NotificationSetting />}
                {activeTab == "support-chat" && <SupportChat />}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

// subscription's extra is_subscription_plans check (previously CheckAuth's
// pathname === "/profile/subscription" special-case) is applied where the
// route is actually known — see SubscriptionPage.jsx — not here, since this
// component is shared by every /profile/* route.
const ProfileDashboard = (): React.JSX.Element => (
  <AuthGate requireAuth>
    <ProfileDashboardInner />
  </AuthGate>
);

export default ProfileDashboard;
