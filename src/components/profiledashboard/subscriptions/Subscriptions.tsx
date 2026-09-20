import { t } from "@/utils/translation";
import { formatDate } from "@/utils/helperFunction";
import { ArrowRight, HelpCircle } from "lucide-react";
import React, { useEffect, useState } from "react";
import LightImage from "@/assets/Vector-filled.svg";
import Image from "next/image";
import BikeImage from "@/assets/bike.svg";
import PlanSelectionModal from "./SubscriptionPlanSelectionModal";
import WalletBalanceModal from "../wallet/WalletBalanceModal";
import SubscriptionsFaqs from "./SubscriptionsFaqs";
import { useSelector } from "react-redux";
import { FiCalendar, FiClock, FiTruck } from "react-icons/fi";
import RightTick from "@/assets/right-tick.svg";
import DollarBag from "@/assets/dollar-bag.svg";
import * as api from "@/api/apiRoutes";
import useCurrency from "@/hooks/useCurrency";

const Subscription = () => {
  const user = useSelector((state: any) => state.User.user);
  const { currency } = useCurrency();

  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [addWalletModal, setAddWalletModal] = useState(false);
  const [isFaqsModalOpen, setIsFaqsModalOpen] = useState(false);
  const [activePlan, setActivePlan] = useState<any>([]);
  const [subscriptionFaqs, setSubscriptionFaqs] = useState<any[]>([]);
  const [totalFaqs, setTotalFaqs] = useState(0);
  const [offset, setOffset] = useState(0);
  const [faqLoading, setFaqLoading] = useState(false);

  const faqLimit = 10;

  const fetchSubscriptionFaqs = async (isLoadMore = false) => {
    try {
      setFaqLoading(true);
      const response: any = await api.getSubscriptionFaqs({
        offset,
        limit: faqLimit,
      });

      setTotalFaqs(response.total);
      if (isLoadMore) {
        setSubscriptionFaqs([...subscriptionFaqs, ...response.data]);
        setOffset(offset + faqLimit);
      } else {
        setSubscriptionFaqs(response.data);
      }
    } catch (error) {
      console.log(error);
    } finally {
      setFaqLoading(false);
    }
  };

  const getActivePlan = async () => {
    try {
      const response: any = await api.getUserActivePlan();
      setActivePlan(response.data);
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount pattern; not derivable from render
    getActivePlan();
    fetchSubscriptionFaqs();
    // fetchSubscriptionFaqs is recreated every render (closes over offset/subscriptionFaqs
    // for load-more); adding it here would refire this mount-only effect on every state change it causes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSelectPlan = (plan: any) => {
    setSelectedPlan(plan);
  };

  const handleFaqOpen = () => {
    setIsFaqsModalOpen(true);
  };

  return (
    <div className="w-full mx-auto h-fit border-2 rounded-lg">
      {user?.has_active_subscription == 1 ? (
        <div>
          <div className="rounded-lg overflow-hidden  bodyBackgroundColor p-4 w-full">
            <div className="footer p-4 flex items-center rounded-lg">
              <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center mr-3  flex-shrink-0">
                <Image
                  src={RightTick}
                  alt="right tick"
                  className={`h-9 w-9 object-contain `}
                  height={30.58}
                  width={32}
                />
              </div>
              <div className="text-white">
                <p className="text-lg font-semibold">
                  {t("your_plan_is_active")}
                </p>
                <p className="text-sm opacity-90">{`${t("your_plan_is_active_desc")} ${user?.subscription_name} ${t("membership")}`}</p>
              </div>
            </div>

            <div className="bg-[#FFDCC9] p-4  mt-4 rounded-lg flex items-center ">
              <div className="w-12 h-12 rounded-full bg-[#FFDCC9]  flex items-center justify-center mr-3 flex-shrink-0">
                <Image
                  src={DollarBag}
                  alt="dollar bag"
                  className={`h-12 w-12 object-contain `}
                  height={22.86}
                  width={22.86}
                />
              </div>
              <p className=" font-semibold text-black dark:text-zinc-100">
                {t("you_saved")}{" "}
                <span>
                  {" "}
                  {currency}
                  {activePlan?.total_money_saved}
                </span>{" "}
                {t("on")} {activePlan?.deliveries_number} {t("deliveries")}
              </p>
            </div>

            {/* 3. Current Plan Details */}
            <div className=" mt-4 rounded-lg">
              <h3 className="text-xl font-bold  mb-3">{t("current_plan")}</h3>
              <div className="border p-4 rounded-lg">
                <div className="flex justify-between items-center mb-4 ">
                  <p className="text-lg font-semibold textColor">
                    {activePlan?.plan_name}
                  </p>
                  <span className="primaryBackColor text-white text-sm font-semibold px-3 py-1 rounded-full">
                    {t("active")}
                  </span>
                </div>

                <div className="grid  grid-cols-1 md:grid-cols-2  gap-4 border items-center  mb-4 p-2 rounded-lg">
                  <div
                    className={`flex items-start ${activePlan?.days_remaining > 1 ? "md:border-r-2" : ""}`}
                  >
                    <FiCalendar className="w-5 h-5 subTextColor mr-2 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm subTextColor">{t("expires_on")}</p>
                      <p className="font-semibold textColor">
                        {activePlan?.days_remaining > 1
                          ? formatDate(user?.subscription_expiry_date)
                          : t("today")}
                      </p>
                    </div>
                  </div>
                  {activePlan?.days_remaining > 1 && (
                    <div className="flex items-start">
                      <FiClock className="w-5 h-5 subTextColor mr-2 mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm subTextColor">
                          {t("days_remaining")}
                        </p>
                        <p className="font-semibold textColor">
                          {activePlan?.days_remaining}{" "}
                          {activePlan?.days_remaining > 1
                            ? t("days")
                            : t("day")}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="backgroundColor p-3 rounded-lg flex items-center">
                  <FiTruck className="w-5 h-5  mr-3 flex-shrink-0" />
                  <p className="textColor text-sm">
                    {t("free_delivery_on_orders_above")}
                    <span className="font-semibold">
                      {" "}
                      {currency}
                      {activePlan?.free_delivery_above}
                    </span>
                  </p>
                </div>
              </div>
            </div>
            {subscriptionFaqs?.length > 0 && (
              <div
                style={{
                  backgroundColor: "var(--swiper-background-color)",
                  borderColor: "var(--border-color)",
                }}
                onClick={handleFaqOpen}
                className="rounded-lg p-4 mt-4 flex items-center justify-between cursor-pointer cardBorder transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div
                    style={{ backgroundColor: "var(--light-primary-color)" }}
                    className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  >
                    <HelpCircle className="w-5 h-5 md:w-6 md:h-6 primaryColor" />
                  </div>
                  <div>
                    <h4 className="font-bold textColor text-sm">
                      {t("faqs_for_subscription")}
                    </h4>
                    <p className="subTextColor text-xs mt-0.5">
                      {t("get_answer_to_common_queries")}
                    </p>
                  </div>
                </div>

                <ArrowRight className="w-5 h-5 textColor" />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div className="w-full backgroundColor flex justify-between items-center">
            <h2 className=" text-base md:text-xl font-bold p-4">
              {user?.subscription_name}
            </h2>
          </div>
          <div className="w-full mx-auto h-fit space-y-6 p-6">
            <div
              style={{ backgroundColor: "var(--footer-background-color)" }}
              className="rounded-3xl p-5 md:p-6 text-white shadow-xl"
            >
              <div className="flex gap-4 mb-6 items-center">
                <div className="flex-shrink-0">
                  <div className="p-3 bg-white rounded-full  h-16 w-16 ">
                    <Image
                      src={LightImage}
                      alt="light logo"
                      className={`h-12 w-12 object-contain `}
                      height={48}
                      width={40}
                      unoptimized
                    />
                  </div>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">
                    {`${user?.subscription_name}  ${t("save_more_with_eCommercemax")}`}
                  </h2>
                  <p className="text-[#8BA2B3] text-base font-medium mt-1 leading-relaxed">
                    {`${user?.subscription_name} ${t("save_more_with_eCommercemax_desc")} `}
                  </p>
                </div>
              </div>

              <div className="dashedBorder"></div>

              <div className=" my-6 flex flex-col gap-2">
                <h3 className=" font-bold">{t("max_benefits")}</h3>

                <div
                  style={{ backgroundColor: "var(--button-background-color)" }}
                  className="rounded-xl p-4 flex items-center gap-4"
                >
                  <div
                    style={{
                      backgroundColor: "var(--footer-background-color)",
                    }}
                    className="p-3 rounded-lg flex-shrink-0"
                  >
                    <Image
                      src={BikeImage}
                      className={`h-8 w-8 object-contain `}
                      alt="light logo"
                      unoptimized
                    />
                  </div>
                  <div className="flex-grow">
                    <h4 className="textColor font-bold text-base">
                      {t("free_delivery")}
                    </h4>
                    <p className="subTextColor text-sm mt-0.5 leading-snug">
                      {t("free_delivery_perks")}
                    </p>
                  </div>
                </div>
              </div>

              <button
                className="w-full mt-6 primaryBackColor hover:opacity-90 active:opacity-80 transition-opacity text-white font-normal text-xl py-3.5 rounded-lg flex items-center justify-center gap-2"
                onClick={() => setIsPlanModalOpen(true)}
              >
                {t("choose_your_plan")}
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>

            <div
              style={{
                backgroundColor: "var(--swiper-background-color)",
                borderColor: "var(--border-color)",
              }}
              onClick={handleFaqOpen}
              className="rounded-lg p-4 flex items-center justify-between cursor-pointer cardBorder transition-colors"
            >
              <div className="flex items-center gap-4">
                <div
                  style={{ backgroundColor: "var(--light-primary-color)" }}
                  className="w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                >
                  <HelpCircle className="w-5 h-5 md:w-6 md:h-6 primaryColor" />
                </div>
                <div>
                  <h4 className="font-bold textColor text-sm">
                    {t("faqs_for_subscription")}
                  </h4>
                  <p className="subTextColor text-xs mt-0.5">
                    {t("get_answer_to_common_queries")}
                  </p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 textColor" />
            </div>
          </div>
        </div>
      )}
      <PlanSelectionModal
        isOpen={isPlanModalOpen}
        onClose={() => setIsPlanModalOpen(false)}
        onSelectPlan={onSelectPlan}
        selectedPlan={selectedPlan}
        setAddWalletModal={setAddWalletModal}
      />
      <WalletBalanceModal
        setAddWalletModal={setAddWalletModal}
        addWalletModal={addWalletModal}
        type="subscription"
        selectedPlan={selectedPlan}
      />
      <SubscriptionsFaqs
        isOpen={isFaqsModalOpen}
        setIsOpen={setIsFaqsModalOpen}
        faqs={subscriptionFaqs}
        totalFaqs={totalFaqs}
        faqLoading={faqLoading}
        fetchSubscriptionFaqs={fetchSubscriptionFaqs}
      />
    </div>
  );
};

export default Subscription;
