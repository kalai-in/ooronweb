"use client" 
import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { t } from "@/utils/translation";
import Image from "next/image";
import { useDispatch, useSelector } from "react-redux";
import * as api from "@/api/apiRoutes";
import { RiCloseFill } from "react-icons/ri";

import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import { addUserBalance } from "@/redux/slices/userSlice";
import { CiWallet } from "react-icons/ci";
// Third-party SDK loaded dynamically client-side only; no bundled types.
let PaystackPop: any;

if (typeof window !== "undefined") {
  import("@paystack/inline-js").then((module) => {
    PaystackPop = module.default;
  });
}
// payment SVGS
import CashfreeImage from "@/assets/payment_methods_svgs/ic_cashfree.svg";
import RazorpayImage from "@/assets/payment_methods_svgs/ic_razorpay.svg";
import PaypalImage from "@/assets/payment_methods_svgs/ic_paypal.svg";
import PaystackImage from "@/assets/payment_methods_svgs/ic_paystack.svg";
import StriperImage from "@/assets/payment_methods_svgs/ic_stripe.svg";
import MidtransImage from "@/assets/payment_methods_svgs/Midtrans.svg";
import PhonePeImage from "@/assets/payment_methods_svgs/Phonepe.svg";
import PaytabsImage from "@/assets/payment_methods_svgs/ic_paytabs.svg";
// import StripeModal from "@/components/checkoutpage/StripeModal";
import dynamic from "next/dynamic";

const StripeModal = dynamic(
  () => import("@/components/checkoutpage/StripeModal"),
  {
    ssr: false,
  },
);
// See usage comment below — cast to bypass strict non-null prop types
// (clientSecret/amount/stripeTransId are nullable in this form's local state).
const StripeModalAny = StripeModal as any;
import { setPhonePeCheckoutDetails } from "@/redux/slices/checkoutSlice";
import useZoneHref from "@/hooks/useZoneHref";
import useCurrency from "@/hooks/useCurrency";

interface PaymentMethodConfig {
  key: string;
  label: string;
  image: any;
}

const paymentMethodsConfig: PaymentMethodConfig[] = [
  { key: "razorpay_payment_method", label: "razorpay", image: RazorpayImage },
  { key: "paypal_payment_method", label: "paypal", image: PaypalImage },
  { key: "paystack_payment_method", label: "paystack", image: PaystackImage },
  { key: "stripe_payment_method", label: "stripe", image: StriperImage },
  { key: "cashfree_payment_method", label: "cashfree", image: CashfreeImage },
  { key: "midtrans_payment_method", label: "midtrans", image: MidtransImage },
  { key: "phonepay_payment_method", label: "phonepe", image: PhonePeImage },
  { key: "paytabs_payment_method", label: "paytabs", image: PaytabsImage },
];

interface WalletBalanceModalProps {
  addWalletModal: boolean;
  setAddWalletModal: (open: boolean) => void;
  type?: string;
  selectedPlan?: any;
}

const WalletBalanceModal = ({
  addWalletModal,
  setAddWalletModal,
  type = "wallet",
  selectedPlan = null,
}: WalletBalanceModalProps) => {
  const zoneHref = useZoneHref();
  const setting = useSelector((state: any) => state.Setting);
  const { currency } = useCurrency();
  const user = useSelector((state: any) => state?.User);
  const city = useSelector((state: any) => state.City.city);
  const dispatch = useDispatch();
  const router = useRouter();

  const [selectedPaymentMethod, setSelectPaymentMethod] = useState<string | undefined>();
  const [amount, setAmount] = useState<number | null>(null);
  const [showStripe, setShowStripe] = useState(false);
  const [stripeClientSecret, setStripeClientSecret] = useState("");
  const [stripeTransId, setStripeTransId] = useState<string | null>(null);

  const handleSelectedPaymentMethod = (value: string) => {
    setSelectPaymentMethod(value);
  };

  const enabledPaymentMethods = paymentMethodsConfig.filter(
    (method) =>
      setting?.payment_setting?.[method.key] &&
      setting?.payment_setting?.[method.key] === "1",
  );

  const handleAmount = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(Number(e.target.value));
  };

  useEffect(() => {
    if (addWalletModal === false) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset form state when modal closes
      setSelectPaymentMethod(undefined);
      setAmount(null);
    }
  }, [addWalletModal]);

  const handleSubmit = async () => {
    if (type == "wallet") {
      if (amount === null) {
        toast.error(t("wallet_amount_required"));
        return;
      } else if (amount <= 0) {
        toast.error(t("wallet_amount_must_be_greater_than_zero"));
        return;
      } else if (selectedPaymentMethod === undefined) {
        toast.error(t("wallet_payment_method_required"));
        return;
      } else if (amount % 1 !== 0) {
        toast.error(t("wallet_amount_cannot_be_decimal"));
        return;
      }
    }

    if (type == "subscription") {
      if (selectedPlan?.id === null) {
        toast.error(t("please_select_a_plan"));
        return;
      }
    }

    const subscriptionPlanPrice = selectedPlan?.discounted_price
      ? selectedPlan?.discounted_price
      : selectedPlan?.price;

    if (selectedPaymentMethod === "wallet") {
      if (user?.user?.balance < subscriptionPlanPrice) {
        toast.error(t("insufficient_wallet_balance"));
        return;
      }
    }

    const capitalizedPaymentMethod =
      selectedPaymentMethod!.charAt(0).toUpperCase() +
      selectedPaymentMethod!.slice(1);

    if (capitalizedPaymentMethod !== "Paystack") {
      const result: any = await api.initiateTrasaction({
        paymentMethod: capitalizedPaymentMethod,
        type: type,
        walletAmount: amount,
        subscriptionPlanId: selectedPlan?.id,
      });
      if (result?.status === 1) {
        if (capitalizedPaymentMethod === "Razorpay") {
          handleRazorpayPayment(null, result?.data?.transaction_id, amount);
        } else if (capitalizedPaymentMethod === "Stripe") {
          setStripeClientSecret(result?.data?.client_secret);
          setStripeTransId(result?.data?.id);
          setShowStripe(true);
          // setAddWalletModal(false);
        } else if (capitalizedPaymentMethod === "Wallet") {
          toast.success(t("subscription_add_description"));
          setAddWalletModal(false);
          setTimeout(() => {
            router.push("/profile/subscription");
          }, 2000);
        } else {
          if (capitalizedPaymentMethod == "Phonepe") {
            dispatch(setPhonePeCheckoutDetails(result?.data));
          }
          const paymentUrls: Record<string, string | undefined> = {
            cashfree: result?.data?.redirectUrl,
            phonepe: result?.data?.redirectUrl,
            paytabs: result?.data?.redirectUrl,
            paypal: result?.data?.paypal_redirect_url,
            midtrans: result?.data?.snapUrl,
          };
          // Select specific paymentUrls
          const redirectUrl = paymentUrls[selectedPaymentMethod!];
          if (redirectUrl) {
            router.push(redirectUrl);
          } else {
            console.error("Unsupported payment method:", selectedPaymentMethod);
          }
        }
      } else {
        setAddWalletModal(false);
        toast.error(result?.message);
      }
    } else {
      handlePayStackPayment(
        type,
        selectedPlan,
        amount,
        capitalizedPaymentMethod,
      );
    }
  };

  const handlePayStackPayment = async (
    type: string,
    selectedPlan: any,
    amount: number | null,
    capilizePaymeneMethod: string,
  ) => {
    const finalAmount = type === "subscription" ? selectedPlan?.price : amount;
    try {
      const handler = PaystackPop.setup({
        key:
          setting.payment_setting &&
          setting.payment_setting.paystack_public_key,
        email: user && user?.user?.email,
        amount: parseFloat(finalAmount) * 100,
        currency:
          setting?.payment_setting &&
          setting?.payment_setting?.paystack_currency_code,
        ref: new Date().getTime().toString(),
        label: setting?.setting && setting?.setting?.support_email,
        onClose: function () {
          // api.deleteOrder({ orderId: orderId });
          setAddWalletModal(false);
        },
        onError: (error: any) => {
          console.log("Error: ", error.message);
        },
        callback: async function (res: any) {
          try {
            // setPaymentLoading(true)
            const response: any = await api.addTransaction({
              transactionId: res.reference,
              paymentMethod: capilizePaymeneMethod,
              type: type,
              subscriptionPlanId: selectedPlan?.id,
              walletAmount: amount,
              latitude: city?.latitude,
              longitude: city?.longitude,
            });
            if (response.status == 1) {
              // setPaymentLoading(true)
              // toast.success(response.message);
              dispatch(addUserBalance({ data: amount as number | string }));
              setAddWalletModal(false);
              router.push(
                `/web-payment-status?type=${type}&status_code=200&status=success`,
              );
              // setIsOrderPlaced(true);
              // dispatch(setCartSubTotal({ data: 0 }));
            } else {
              // setPaymentLoading(true)
              toast.error(response.message);
              setAddWalletModal(false);
            }
          } catch (error) {
            console.log("Error", error);
          }
        },
      });
      handler.openIframe();
    } catch (error) {
      console.log("Paytabs Error", error);
    }
  };

  const initializeRazorpay = (): Promise<boolean> => {
    return new Promise((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      // document.body.appendChild(script);
      script.onload = () => {
        resolve(true);
      };
      script.onerror = () => {
        resolve(false);
      };

      document.body.appendChild(script);
    });
  };

  const handleRazorpayPayment = async (
    order_id: string | null,
    razorpay_transaction_id: string,
    amount: number | null,
  ) => {
    try {
      const res = await initializeRazorpay();
      if (!res) {
        console.error("RazorPay SDK Load Failed");
        return;
      }
      const key = setting?.payment_setting?.razorpay_key;
      const convertedAmount = Math.floor((amount ?? 0) * 100);
      const options: any = {
        key: key,
        amount: convertedAmount,
        currency: "INR",
        name: user?.user?.name,
        description: setting?.setting?.app_name,
        image: setting?.setting?.web_settings.web_logo,
        order_id: razorpay_transaction_id,
        handler: async (res: any) => {
          if (res.razorpay_payment_id) {
            try {
              const response: any = await api.addTransaction({
                transactionId: res.razorpay_payment_id,
                paymentMethod:
                  selectedPaymentMethod!.charAt(0).toUpperCase() +
                  selectedPaymentMethod!.slice(1),
                type: type,
                subscriptionPlanId: selectedPlan?.id,
                walletAmount: amount,
                latitude: city?.latitude,
                longitude: city?.longitude,
              });
              if (response.status === 1) {
                dispatch(addUserBalance({ data: amount as number | string }));
                setAddWalletModal(false);
                router.push(
                  `/web-payment-status?type=${type}&status_code=200&status=success`,
                );
              } else {
                toast.error(response.message);
                setAddWalletModal(false);
              }
            } catch (error) {
              console.log("Transaction error:", error);
            }
          } else {
            console.log("Razorpay Payment Failed");
          }
        },
        modal: {
          confirm_close: true,
          ondismiss: async (reason: any) => {
            if (reason === undefined) {
              setAddWalletModal(false);
            }
          },
        },
        retry: {
          enabled: false,
        },
        prefill: {
          name: user?.user?.name,
          email: user?.user?.email,
          contact: user?.user?.mobile,
        },
        notes: {
          address: "Razorpay Corporate",
        },
        theme: {
          color: setting?.setting?.web_settings.color,
        },
      };

      // if (typeof window !== "undefined") {
      // window.Razorpay is injected by the SDK script loaded above; no bundled
      // types exist for it, so it's accessed via `any`.
      const rzpay = new (window as any).Razorpay(options);
      rzpay.on("payment.cancel", (response: any) => {
        alert("Payment Cancelled");
        toast.error("Payment Cancelled");
      });

      rzpay.on("payment.failed", (response: any) => {
        setAddWalletModal(false);
        router.push(zoneHref(`/web-payment-status?type=${type}&status=failed`));
      });

      rzpay.open();
    } catch (error) {
      console.error("Error initializing Razorpay:", error);
    }
  };

  return (
    <div>
      {/* `className` is not a Dialog (Radix Root) prop — Root renders no DOM
          node, so this was already a no-op at runtime pre-TS. Kept as-is
          (pure typing pass); cast to bypass the resulting type error without
          changing the props actually passed. */}
      <Dialog
        {...({
          open: addWalletModal,
          onOpenChange: setAddWalletModal,
          className: "bg-black h-full w-full",
        } as any)}
      >
        {addWalletModal && (
          <div className="fixed inset-0 bg-black bg-opacity-60 z-40"></div>
        )}
        <DialogContent
          aria-describedby="addWalletModal "
          className="max-h-[100vh]  border-0 overflow-y-auto"
        >
          <DialogHeader className="flex flex-row justify-between items-center">
            <DialogTitle>
              <h1 className="font-bold text-xl">
                {type == "wallet" ? t("add_to_wallet") : t("complete_payment")}
              </h1>
            </DialogTitle>
            <div className="closeButtonBg rounded-full p-[8px] cursor-pointer">
              <RiCloseFill size={22} onClick={() => setAddWalletModal(false)} />
            </div>
          </DialogHeader>
          <div>
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-2">
                <>
                  {type == "wallet" ? (
                    <>
                      <label
                        htmlFor="walletAmount"
                        className="text-sm font-semibold SecondaryTextColor"
                      >
                        {t("amount")}
                      </label>
                      <div className="relative">
                        {currency && (
                          <span className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-4 text-lg font-bold SecondaryTextColor">
                            {currency}
                          </span>
                        )}
                        <input
                          type="number"
                          id="walletAmount"
                          value={amount !== null ? amount : ""}
                          placeholder={t("type_amount")}
                          className={`w-full rounded-xl border cardBorder bg-transparent py-3 pe-4 text-xl font-bold outline-none transition-colors focus:primaryColorBorder placeholder:text-base placeholder:font-normal placeholder:SecondaryTextColor ${
                            currency ? "ps-10" : "ps-4"
                          }`}
                          onChange={(e) => handleAmount(e)}
                        />
                      </div>
                    </>
                  ) : (
                    <div className="w-full backgroundColor p-4 rounded-md border-1">
                      <div
                        className="space-y-2 pb-4"
                        style={{ borderColor: "var(--border-color)" }}
                      >
                        <div
                          className={
                            "flex justify-between items-center py-2 border-b-2 border-dashed"
                          }
                        >
                          <span className="font-bold text-base">
                            {t("subscription_plan")}
                          </span>
                          <span className="font-bold text-base textColor">
                            {selectedPlan?.name}
                          </span>
                        </div>

                        <div
                          className={"flex justify-between items-center py-2"}
                        >
                          <span className="text-base font-medium ">
                            {t("original_price")}
                          </span>
                          <span className=" font-semibold ">
                            <span className="text-xl">
                              {currency}
                              {selectedPlan?.discounted_price > 0
                                ? selectedPlan?.discounted_price
                                : selectedPlan?.price}
                            </span>
                            {selectedPlan?.discounted_price > 0 && (
                              <span className="text-sm line-through text-gray-400 ml-2">
                                {currency}
                                {selectedPlan?.price?.toFixed(2)}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                      <div
                        className={`flex justify-between items-center  bodyBackgroundColor p-3 rounded-md `}
                      >
                        <span className="text-lg font-bold textColor">
                          {t("total_amount")}
                        </span>
                        <span className="text-lg font-bold textColor">
                          {selectedPlan?.discounted_price
                            ? selectedPlan?.discounted_price
                            : selectedPlan?.price}
                        </span>
                      </div>
                    </div>
                  )}
                </>
              </div>
              <div className="flex flex-col gap-3">
                <h1 className="font-bold text-base">
                  {t("choose_payment_method")}
                </h1>
                <div className="flex flex-col gap-2">
                  {type == "subscription" && (
                    <div
                      key={"wallet"}
                      data-method={"wallet"}
                      role="button"
                      className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 transition-all ${
                        selectedPaymentMethod === "wallet"
                          ? "primaryColorBorder primaryLightBack"
                          : "cardBorder hover:border-gray-300 dark:hover:border-zinc-600"
                      }`}
                      onClick={() => handleSelectedPaymentMethod("wallet")}
                    >
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-white/10">
                          <CiWallet size={22} className="primaryColor" />
                        </span>
                        <p className="font-semibold textColor">{t("wallet")}</p>
                      </div>
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                          selectedPaymentMethod === "wallet"
                            ? "primaryColorBorder"
                            : "border-gray-300 dark:border-zinc-600"
                        }`}
                      >
                        {selectedPaymentMethod === "wallet" && (
                          <span className="h-2.5 w-2.5 rounded-full primaryBackColor" />
                        )}
                      </span>
                    </div>
                  )}
                  {enabledPaymentMethods.map((method) => {
                    const selected = selectedPaymentMethod === method.label;
                    return (
                      <div
                        key={method.key}
                        data-method={method.label}
                        role="button"
                        className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border p-3 transition-all ${
                          selected
                            ? "primaryColorBorder primaryLightBack"
                            : "cardBorder hover:border-gray-300 dark:hover:border-zinc-600"
                        }`}
                        onClick={() =>
                          handleSelectedPaymentMethod(method.label)
                        }
                      >
                        <div className="flex items-center gap-3">
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white shadow-sm dark:bg-white/10">
                            <Image
                              src={method.image}
                              className="h-7 w-7 object-contain"
                              height={28}
                              width={28}
                              unoptimized
                              alt={t(method.label)}
                            />
                          </span>
                          <p className="font-semibold capitalize textColor">
                            {t(method.label)}
                          </p>
                        </div>
                        {/* Custom radio */}
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                            selected
                              ? "primaryColorBorder"
                              : "border-gray-300 dark:border-zinc-600"
                          }`}
                        >
                          {selected && (
                            <span className="h-2.5 w-2.5 rounded-full primaryBackColor" />
                          )}
                        </span>
                      </div>
                    );
                  })}
                  <button
                    className="mt-3 w-full rounded-xl primaryBackColor py-3 text-base font-bold text-white shadow-sm transition-all hover:opacity-90 hover:shadow-md active:scale-[0.98]"
                    onClick={handleSubmit}
                  >
                    {type == "wallet" ? t("add_money") : t("complete_payment")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* amount/stripeTransId are nullable here (unset until the user fills
          the form / a transaction is initiated) while StripeModal's props are
          non-null; same StripeModal usage useOrderPlacement.tsx casts for the
          same reason. Cast rather than change values, to keep behavior
          byte-for-byte the same. */}
      <StripeModalAny
        clientSecret={stripeClientSecret}
        stripeTransId={stripeTransId}
        showStripe={showStripe}
        setShowStripe={setShowStripe}
        amount={amount}
        setWalletModal={setAddWalletModal}
        type={type}
        // subscriptionPlanId={subscriptionPlanId}
      />
    </div>
  );
};

export default WalletBalanceModal;
