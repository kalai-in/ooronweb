import React, { useEffect, useState } from "react";
import { X, Truck, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { DialogTitle } from "@radix-ui/react-dialog";
import { t } from "@/utils/translation";
import * as api from "@/api/apiRoutes";
import { toast } from "react-toastify";
import useCurrency from "@/hooks/useCurrency";

interface SubscriptionPlanSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPlan: any;
  onSelectPlan: (plan: any) => void;
  setAddWalletModal: (open: boolean) => void;
}

const PlanSelectionModal = ({
  isOpen,
  onClose,
  selectedPlan,
  onSelectPlan,
  setAddWalletModal,
}: SubscriptionPlanSelectionModalProps) => {
  const [plans, setPlans] = useState<any[]>([]);

  const { currency } = useCurrency();

  const handleFetchPlans = async () => {
    try {
      const plans: any = await api.getSubscriptionPlans();
      setPlans(plans?.data?.plans);
    } catch (error) {
      console.log("error", error);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount pattern; not derivable from render
    handleFetchPlans();
  }, []);

  const getPlanCardStyle = (planValue: any) => {
    const isSelected = selectedPlan === planValue;
    return {
      backgroundColor: "var(--body-background-color)",
      borderColor: isSelected ? "var(--primary-color)" : "var(--border-color)",
    };
  };

  const handleSetWalletModal = () => {
    if (!selectedPlan) {
      toast.error(t("please_select_a_plan"));
      return;
    }
    onClose();
    setAddWalletModal(true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className="p-6 focus-visible:outline-none focus:outline-none rounded-2xl shadow-2xl max-w-4xl w-full  overflow-scroll "
        style={{ backgroundColor: "var(--body-background-color)" }}
      >
        <DialogHeader>
          <DialogTitle>
            <div className="flex justify-between items-start  border-b pb-2">
              <div>
                <h2 className="text-2xl font-bold textColor">
                  {t("choose_your_plan")}
                </h2>
                <p className="text-sm subTextColor mt-1">
                  {t("select_subscription_desc")}
                </p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors cursor-pointer"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </DialogTitle>
        </DialogHeader>
        <div className="">
          <div className="mt-6 space-y-4 h-[calc(100vh-20rem)] overflow-scroll">
            {plans?.map((plan) => (
              <div
                key={plan.id}
                onClick={() => onSelectPlan(plan)}
                style={getPlanCardStyle(plan.id)}
                className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedPlan?.id === plan.id
                    ? "shadow-md"
                    : "hover:border-gray-300"
                }`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-lg font-bold textColor">
                        {plan?.translations?.name}
                      </span>
                      <span className="text-xs font-medium text-white primaryBackColor py-0.5 px-2 rounded-full">
                        {plan.days} {t("days")}
                      </span>
                    </div>
                    <div className="textColor font-bold flex items-center">
                      <span className="text-xl">
                        {currency}
                        {Number(plan.discounted_price) > 0
                          ? Number(plan.discounted_price).toFixed(2)
                          : Number(plan.price).toFixed(2)}
                      </span>
                      {Number(plan.discounted_price) > 0 && (
                        <span className="text-sm line-through text-gray-400 ml-2">
                          {currency}
                          {Number(plan.price).toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0`}
                    style={{
                      borderColor:
                        selectedPlan?.id === plan.id
                          ? "var(--primary-color)"
                          : "var(--border-color)",
                    }}
                  >
                    {selectedPlan?.id === plan.id && (
                      <div className="w-2.5 h-2.5 rounded-full primaryBackColor" />
                    )}
                  </div>
                </div>
                <div
                  className="mt-3 p-3 rounded-lg flex items-center gap-3"
                  style={{ backgroundColor: "var(--swiper-background-color)" }}
                >
                  <Truck className="w-5 h-5 subTextColor" />
                  <span className="text-sm subTextColor">
                    {t("free_delivery_on")} {currency}
                    {plan.free_delivery_above}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-6 flex justify-end w-full">
          <button
            className="items-center text-xl primaryBackColor  text-white py-2 px-4 rounded-md flex gap-6"
            onClick={handleSetWalletModal}
          >
            {t("proceed_to_payment")}
            <ArrowRight className="w-5 h-5" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PlanSelectionModal;
