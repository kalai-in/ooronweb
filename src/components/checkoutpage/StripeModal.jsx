import React, { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { RiCloseFill } from "react-icons/ri";
import {
  useStripe,
  useElements,
  CardElement,
  ElementsConsumer,
  Elements,
} from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { useDispatch, useSelector } from "react-redux";
import { t } from "@/utils/translation";
import { addUserBalance } from "@/redux/slices/userSlice";
import { useRouter } from "next/router";

const getCardOptions = (theme) => {
  return {
    iconStyle: "solid",
    style: {
      base: {
        color: theme === "dark" ? "#87bbfd" : "#87bbfd",

        fontWeight: 500,
        fontFamily: "Roboto, Open Sans, Segoe UI, sans-serif",
        fontSize: "16px",
        fontSmoothing: "antialiased",
        ":-webkit-autofill": {
          color: theme === "dark" ? "#fce883" : "#fce883",
        },
        "::placeholder": {
          color: theme === "dark" ? "#87bbfd" : "#87bbfd",
        },
      },
      invalid: {
        color: "#fa755a",
        iconColor: "#fa755a",
      },
    },
  };
};
const CheckoutForm = ({
  clientSecret,
  setShowStripe,
  amount,
  transactionId,
  setWalletModal,
  stripeOrderId,
  type,
}) => {
  const dispatch = useDispatch();
  const user = useSelector((state) => state?.User?.user);
  const theme = useSelector((state) => state.Theme.theme);
  const router = useRouter();
  const cardElementOptions = getCardOptions(theme);
  const stripe = useStripe();
  const elements = useElements();
  const [isLoading, setIsLoading] = useState(false);
  // const type = stripeOrderId ? "order" : "wallet";
  const handleOnSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    if (!stripe || !elements) {
      console.log("Stripe not loaded yet");
      setIsLoading(false); // re-enable the pay button; Stripe wasn't ready
      return;
    }

    try {
      const { paymentIntent, error } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: elements.getElement(CardElement),
            billing_details: {
              name: user.name,
              address: {
                line1: "510 Townsend St",
                postal_code: "98140",
                city: "San Francisco",
                state: "CA",
                country: "US",
              },
            },
          },
        },
      );
      if (paymentIntent?.status === "succeeded") {
        await handleAddPayment();
      } else {
        setShowStripe(false);
        setWalletModal(false);
        const urlOptions = {
          type: type,
          status: "failed",
        };
        if (stripeOrderId) {
          urlOptions.order_id = stripeOrderId;
        }
        router.push({ pathname: `/web-payment-status`, query: urlOptions });
      }
    } catch (error) {
      console.log("Error", error);
    }
    setIsLoading(false);
  };

  // No add_transaction call here: Stripe payments are recorded server-side off
  // the payment intent (webhook), so posting one from the client would double
  // up the record. Other gateways (Razorpay/Paystack) still report from the
  // client because they have no such server-side confirmation.
  const handleAddPayment = async () => {
    if (type == "wallet") {
      dispatch(addUserBalance({ data: amount }));
      setWalletModal(false);
    }
    setShowStripe(false);
    const urlOptions = {
      type: type,
      status_code: 200,
      status: "success",
    };
    if (stripeOrderId) {
      urlOptions.order_id = stripeOrderId;
    }
    router.push({ pathname: `/web-payment-status`, query: urlOptions });
  };

  return (
    <form
      onSubmit={handleOnSubmit}
      className={"min-h-[150px]  flex flex-col justify-center gap-4 mt-3"}
    >
      <div className="h-full flex flex-col justify-evenly gap-4">
        <CardElement options={cardElementOptions} />
      </div>
      <div className="flex justify-center">
        <button
          className={
            "text-white text-base font-bold px-4 py-2 mt-4 primaryBackColor rounded-sm"
          }
          disabled={!stripe || isLoading}
        >
          {isLoading ? t("loading") : t("submit")}
        </button>
      </div>
    </form>
  );
};

const InjectedCheckoutForm = ({
  clientSecret,
  transactionId,
  setShowStripe,
  amount,
  setWalletModal,
  stripeOrderId,
  type,
}) => {
  return (
    <ElementsConsumer>
      {({ elements, stripe }) => (
        <CheckoutForm
          elements={elements}
          stripe={stripe}
          clientSecret={clientSecret}
          transactionId={transactionId}
          setShowStripe={setShowStripe}
          amount={amount}
          setWalletModal={setWalletModal}
          stripeOrderId={stripeOrderId}
          type={type}
        />
      )}
    </ElementsConsumer>
  );
};

const StripeModal = ({
  showStripe,
  setShowStripe,
  clientSecret,
  stripeTransId,
  amount,
  setWalletModal,
  stripeOrderId,
  type,
}) => {
  const setting = useSelector((state) => state.Setting);
  const stripePromise = useMemo(() => {
    if (!setting?.payment_setting?.stripe_publishable_key) return null;
    return loadStripe(setting.payment_setting.stripe_publishable_key);
  }, [setting]);
  const theme = useSelector((state) => state.Theme.theme);
  const cardElementOptions = getCardOptions(theme);

  return (
    <Dialog open={showStripe} className="bg-gray-400">
      <DialogContent className="max-w-[600px]" title={t("stripe")}>
        <DialogHeader>
          <div className="flex flex-row justify-between items-center">
            <p className="text-2xl font-bold">{t("stripe")}</p>
            <div className="closeButtonBg rounded-full p-[8px] gap-[4px]">
              <RiCloseFill size={22} onClick={() => setShowStripe(false)} />
            </div>
          </div>
        </DialogHeader>
        <div>
          <Elements
            stripe={stripePromise}
            options={cardElementOptions}
            clientSecret={clientSecret}
            transactionId={stripeTransId}
          >
            <InjectedCheckoutForm
              setShowStripe={setShowStripe}
              stripe={stripePromise}
              options={cardElementOptions}
              clientSecret={clientSecret}
              transactionId={stripeTransId}
              amount={amount}
              setWalletModal={setWalletModal}
              stripeOrderId={stripeOrderId}
              type={type}
            />
          </Elements>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StripeModal;
