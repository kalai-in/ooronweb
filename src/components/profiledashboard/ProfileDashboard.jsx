import React, { useState, useEffect, useCallback } from "react";
import BreadCrumb from "../breadcrumb/BreadCrumb";
import ProfileSidebar from "./ProfileSidebar";
import Profile from "./Profile";
import Address from "./Address";
import ActiveOrders from "./orders/ActiveOrders";
import OrderHistory from "./orders/PrevOrder";
import Wishlist from "./Wishlist";
import Subscription from "./subscriptions/Subscriptions";
import { useRouter } from "next/router";
import WalletHistory from "./wallet/WalletHistory";
import TransactionHistory from "./transactions/TransactionHistory";
import Notifications from "./Notifications";
import { setCurrentUser } from "@/redux/slices/userSlice";
import * as api from "@/api/apiRoutes";
import { useDispatch, useSelector } from "react-redux";
import ResetPassword from "./ResetPassword";
import withAuth from "@/checkauth/CheckAuth";
import CardSkeleton from "../skeleton/CardSkeleton";
import SupportChat from "@/components/chat/support/SupportChat";
import NotificationSetting from "./notification-setting/NotificationSetting";

const ProfileDashboard = () => {
  const dispatch = useDispatch();
  const [selectedTab, setSelectedTab] = useState("profile");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const city = useSelector((state) => state.City.city);

  useEffect(() => {
    const currentTab = router.pathname.split("/").pop();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs selected tab from route pathname
    setSelectedTab(currentTab || "profile");
  }, [router.pathname]);

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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount pattern; not derivable from render
    getCurrentUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeTab = router.pathname.split("/").pop();

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

export default withAuth(ProfileDashboard);
