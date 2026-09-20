import Link from "next/link";
import React, { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { t } from "@/utils/translation";
import Image from "next/image";
import LogoutModal from "../logoutmodal/LogoutModal";
import {
  FiUser,
  FiMapPin,
  FiStar,
  FiShoppingBag,
  FiClock,
  FiHeart,
  FiCreditCard,
  FiFileText,
  FiBell,
  FiSettings,
  FiClipboard,
  FiMessageSquare,
  FiGift,
  FiLogOut,
} from "react-icons/fi";

import ReferAndEarnModal from "@/components/refer-and-earn/ReferAndEarnModal";
import LightImage from "@/assets/Vector.svg";
import MoneyImage from "@/assets/bx-money.svg";
import BikeImage from "@/assets/bike.svg";
import { FaArrowRight } from "react-icons/fa";
import { formatDate } from "@/utils/helperFunction";
import { ArrowRight } from "lucide-react";
import { toast } from "react-toastify";
import useZoneHref from "@/hooks/useZoneHref";

interface ProfileSidebarProps {
  setSelectedTab: (tab: string) => void;
  selectedTab: string;
}

const ProfileSidebar = ({ setSelectedTab, selectedTab }: ProfileSidebarProps) => {
  const zoneHref = useZoneHref();
  const router = useRouter();
  const pathname = usePathname();
  const user = useSelector((state: any) => state.User.user);
  const setting = useSelector((state: any) => state?.Setting?.setting);
  const countrySetting = useSelector(
    (state: any) => state.CountrySetting.countrySetting,
  );
  // Hide the Refer & Earn menu entry when both reward amounts are 0.
  const hasReferReward =
    countrySetting?.referral_credit_referred > 0 ||
    countrySetting?.referral_credit_first_order > 0;

  const [showReferAndEarn, setShowReferAndEarn] = useState(false);
  const [showLogout, setShowLogout] = useState(false);
  const [current, setCurrent] = useState(0);

  // `slides` always has a fixed length of 3 (see below); using the literal
  // here keeps the interval stable across renders instead of depending on
  // `slides`, which is a new array every render.
  const SLIDES_COUNT = 3;

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrent((prev) => (prev + 1) % SLIDES_COUNT);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleTabChange = (tabName: string) => {
    setSelectedTab(tabName);
  };

  const handleShowReferAndEarn = () => {
    setShowReferAndEarn(true);
  };

  const activeTab = (pathname || "").split("/").pop();

  const slides = [
    {
      id: 1,
      text: `${t("subscribe")} ${user?.subscription_name}`,
      image: (
        <div className="p-2 md:p-1.5 lg:p-2  primaryBackColor rounded-full border border-white h-9 w-9 md:h-7 md:w-7 lg:w-9 lg:h-9 shrink-0">
          <Image
            src={LightImage}
            alt="light logo"
            className={`h-5 w-5 md:w-4 md:h-4 lg:w-5 lg:h-5 object-contain `}
            height={20}
            width={20}
            unoptimized
          />
        </div>
      ),
      theme: "primaryColorBorder primaryLightBack primaryColor",
    },
    {
      id: 2,
      text: t("go_max_save_more"),
      image: (
        <div className="p-2 md:p-1.5 lg:p-2 bg-[#0186D8] rounded-full border border-white h-9 w-9 md:h-7 md:w-7 lg:w-9 lg:h-9 flex items-center shrink-0">
          <Image
            src={MoneyImage}
            alt="light logo"
            className={`h-6 w-6 md:w-4 md:h-4 lg:w-6 lg:h-6 object-contain `}
            height={20}
            width={20}
          />
        </div>
      ),
      theme: "border-blue-500 bg-[#0186D81F] text-[#0186D8]",
    },
    {
      id: 3,
      text: t("free_delivery_desc"),
      image: (
        <div className="p-2 md:p-1.5 lg:p-2 bg-[#DB9305] rounded-full border  border-white h-9 w-9 md:h-7 md:w-7 lg:w-9 lg:h-9 shrink-0">
          <Image
            src={BikeImage}
            alt="light logo"
            className={`h-5 w-5 md:w-4 md:h-4 lg:w-5 lg:h-5 object-contain `}
            height={20}
            width={20}
          />
        </div>
      ),
      theme: "border-orange-500 bg-[#DB93051F] text-[#DB9305]",
    },
  ];

  const handleSubscriptionClick = () => {
    router.push(zoneHref("/profile/subscription"));
  };

  // No Reset Password entry here: it's a button on the Edit Profile card that
  // opens ResetPasswordModal. The standalone /profile/resetpassword route still
  // works (and is still gated by CheckResetPassword) — it's just not linked.
  const menu = [
    { icon: FiUser, label: t("editProfile"), tab: "profile", href: "/profile" },
    {
      icon: FiMapPin,
      label: t("manage_address"),
      tab: "address",
      href: "/profile/address",
    },
    user?.is_subscription_plans && {
      icon: FiStar,
      label: user?.subscription_name,
      tab: "subscription",
      href: "/profile/subscription",
    },
    {
      icon: FiShoppingBag,
      label: t("active_orders"),
      tab: "activeorders",
      href: "/profile/activeorders",
    },
    {
      icon: FiClock,
      label: t("order_history"),
      tab: "orderhistory",
      href: "/profile/orderhistory",
    },
    {
      icon: FiHeart,
      label: t("my_wishlist"),
      tab: "wishlist",
      href: "/profile/wishlist",
    },
    {
      icon: FiCreditCard,
      label: t("my_wallet"),
      tab: "wallethistory",
      href: "/profile/wallethistory",
    },
    {
      icon: FiFileText,
      label: t("transaction_history"),
      tab: "transaction",
      href: "/profile/transaction",
    },
    {
      icon: FiBell,
      label: t("notification"),
      tab: "notifications",
      href: "/profile/notifications",
    },
    {
      icon: FiSettings,
      label: t("notification_setting"),
      tab: "notification-setting",
      href: "/profile/notification-setting",
    },
    hasReferReward && {
      icon: FiGift,
      label: t("referandearn"),
      onClick: handleShowReferAndEarn,
    },
    { icon: FiLogOut, label: t("logout"), onClick: () => setShowLogout(true) },
  ].filter(Boolean);

  return (
    <div>
      <div className="cardBorder overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 shadow-sm">
        {/* Profile header — soft brand-tinted banner, avatar overlaps into it */}
        <div className="relative">
          <div
            className="h-20"
            style={{
              backgroundImage:
                "linear-gradient(to bottom, color-mix(in srgb, var(--primary-color) 16%, transparent), color-mix(in srgb, var(--primary-color) 4%, transparent))",
            }}
          />
          <div className="flex flex-col items-center text-center gap-2 px-6 pb-5 -mt-12">
            <div className="h-20 w-20 rounded-full p-[3px] shrink-0 bg-white dark:bg-zinc-900 shadow-md ring-1 ring-[color-mix(in_srgb,var(--primary-color)_20%,transparent)]">
              <Image
                src={user?.profile || setting?.web_settings?.placeholder_image}
                alt="Profile"
                width={96}
                height={96}
                className="h-full w-full rounded-full object-cover"
                unoptimized
              />
            </div>
            <div className="min-w-0 w-full">
              <p className="text-base font-bold textColor truncate">
                {user?.name}
              </p>
              {user?.email && (
                <p className="text-xs SecondaryTextColor truncate mt-0.5">
                  {user?.email}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Inset divider */}
        <div className="px-4">
          <div className="border-b border-[color:var(--border-color)]" />
        </div>

        {/* Subscription promo */}
        {user?.is_subscription_plans && (
          <div className="p-4 border-b border-[color:var(--border-color)]">
            <div className="flex gap-6 flex-col">
              <div className="flex gap-3">
                {user?.has_active_subscription == 1 ? (
                  <div className="flex items-start w-full justify-between gap-2">
                    <div className="flex gap-2">
                      <div className="p-[5.5px] gap-[6px] primaryBackColor rounded-full border border-white h-8 w-8 shrink-0">
                        <Image
                          src={LightImage}
                          alt="light logo"
                          className={`h-full w-full object-contain `}
                          height={24}
                          width={24}
                        />
                      </div>
                      <div className="flex flex-col">
                        <h2 className="font-bold text-base text-nowrap">
                          {user?.user_subscription_plan_name}
                        </h2>
                        <p className="text-sm leading-[17px] font-normal">
                          {`${t("expires_on")} ${formatDate(user?.subscription_expiry_date)}`}
                        </p>
                      </div>
                    </div>
                    <span className="primaryBackColor text-white text-sm font-semibold px-3 py-1 rounded-full">
                      {t("active")}
                    </span>
                  </div>
                ) : user?.has_active_subscription == 2 ? (
                  <div className="flex flex-col gap-6">
                    <div className="flex items-start w-full justify-between gap-2 ">
                      <div className="flex gap-[12px] ">
                        <div className="p-[5.5px] gap-[6px] primaryBackColor rounded-full border border-white h-8 w-8 shrink-0">
                          <Image
                            src={LightImage}
                            alt="light logo"
                            className={`h-full w-full object-contain `}
                            height={24}
                            width={24}
                          />
                        </div>
                        <div className="flex flex-col">
                          <h2 className="font-bold text-base">
                            {user?.subscription_name}
                          </h2>
                          <p className="text-sm leading-[17px] font-normal">
                            {t("expired_plan_desc")}
                          </p>
                        </div>
                      </div>

                      <span className="bg-[#DB3D26] text-white text-sm font-semibold px-3 py-1 rounded-full ">
                        {t("expired")}
                      </span>
                    </div>
                    <button
                      className="primaryBackColor text-white text-base font-semibold px-4 py-2 rounded-md flex items-center gap-2 justify-center w-full"
                      onClick={handleSubscriptionClick}
                    >
                      {`${t("renew")} ${user?.subscription_name}`}
                      <ArrowRight className="w-5 h-5 text-white" />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col w-3/4 ">
                    <h2 className="font-bold text-base">
                      {user?.subscription_name}
                    </h2>
                    <p className="text-sm leading-[17px] font-normal ">
                      {t("subscription_desc")}
                    </p>
                  </div>
                )}
              </div>
              {user?.has_active_subscription == 0 && (
                <div className="flex justify-center ">
                  <div
                    className={`relative h-14 w-full max-w-sm overflow-hidden rounded border-[1.5px] transition-colors duration-500 ${slides[current].theme} rounded-md`}
                  >
                    {slides.map((slide, index) => (
                      <div
                        key={slide.id}
                        className={`absolute inset-0 flex items-center justify-center font-semibold transition-all duration-500 ease-in-out cursor-pointer `}
                        style={{
                          transform: `translateY(${(index - current) * 100}%)`,
                          opacity: index === current ? 1 : 0,
                        }}
                        onClick={handleSubscriptionClick}
                      >
                        <div className="flex gap-2 items-center font-bold justify-between px-4 w-full">
                          <div className="flex gap-2 items-center">
                            {slide.image}
                            <div className="text-sm lg:text-[16px]">
                              {slide.text}
                            </div>
                          </div>
                          <div>
                            <FaArrowRight />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Menu */}
        <ul className="flex flex-col gap-0.5 px-4 py-2">
          {menu.map((item) => {
            const Icon = item.icon;
            const active = item.tab && activeTab === item.tab;
            const isLogout = item.label === t("logout");
            const inner = (
              <li
                onClick={
                  item.onClick ? item.onClick : () => handleTabChange(item.tab)
                }
                className={`group flex items-center gap-3 px-2 py-2.5 cursor-pointer transition-colors duration-200 text-sm ${
                  active
                    ? "primaryColor font-semibold"
                    : isLogout
                      ? "text-red-500 hover:text-red-600"
                      : "textColor hover:primaryColor"
                }`}
              >
                <Icon
                  size={18}
                  className={`shrink-0 transition-colors duration-200 ${
                    active
                      ? "primaryColor"
                      : isLogout
                        ? "text-red-500"
                        : "SecondaryTextColor group-hover:primaryColor"
                  }`}
                />
                <span className="flex-1 truncate">{item.label}</span>
                <ArrowRight
                  size={15}
                  className={`shrink-0 transition-all duration-200 ${
                    active
                      ? "primaryColor opacity-100 translate-x-0"
                      : isLogout
                        ? "hidden"
                        : "SecondaryTextColor opacity-0 -translate-x-1.5 group-hover:opacity-70 group-hover:translate-x-0"
                  }`}
                />
              </li>
            );
            return (
              <React.Fragment key={item.label}>
                {/* separate the logout entry with a divider above it */}
                {isLogout && (
                  <div className="my-1 border-t border-[color:var(--border-color)]" />
                )}
                {item.href ? (
                  <Link href={zoneHref(item.href)}>{inner}</Link>
                ) : (
                  inner
                )}
              </React.Fragment>
            );
          })}
        </ul>

        <ReferAndEarnModal
          showReferAndEarn={showReferAndEarn}
          setShowReferAndEarn={setShowReferAndEarn}
        />
        <LogoutModal showLogout={showLogout} setShowLogout={setShowLogout} />
      </div>
    </div>
  );
};

export default ProfileSidebar;
