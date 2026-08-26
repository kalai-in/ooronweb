import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { X } from "lucide-react";
import { t } from "@/utils/translation";
import SubscriptionsFaq from "@/components/faqs/SubscriptionFaqCard";

const SubscriptionsFaqs = ({ isOpen, setIsOpen, faqs, totalFaqs, faqLoading, fetchSubscriptionFaqs }) => {
  const onClose = () => {
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent
        className=" md:p-6 focus-visible:outline-none focus:outline-none shadow-2xl max-w-4xl w-full  "
        style={{ backgroundColor: "var(--body-background-color)" }}
      >
        <DialogHeader>
          <DialogTitle>
            <div className="flex justify-between items-start  border-b pb-2">
              <div>
                <h2 className="text-2xl font-bold textColor">
                  {t("faqs_for_subscription")}
                </h2>
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
        <div className="flex flex-col gap-4 items-center">
          <div className="mt-6 space-y-4 overflow-y-auto overflow-x-hidden   w-full  h-[400px]">
            {faqs.map((faq, index) => (
              <div key={index} className="">
                <SubscriptionsFaq
                  faq={{
                    question: faq?.translations?.question,
                    answer: faq?.translations?.answer
                  }}
                />
              </div>
            ))}
            <div className="col-span-12 mt-6 w-full flex justify-center mx-auto">
              {totalFaqs > faqs?.length ? (
                <button
                  className="bg-[#29363f] rounded-md text-white text-base font-medium gap-1 p-1.5 px-3"
                  onClick={fetchSubscriptionFaqs}
                >
                  {t("load_more")}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SubscriptionsFaqs;
