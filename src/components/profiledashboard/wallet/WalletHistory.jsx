import React, { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { t } from "@/utils/translation";
import * as api from "@/api/apiRoutes";
import { formatCustomDate } from "@/lib/utils";
import NoTransactionFound from "@/assets/empty-state/empty-wallet.svg";
import NotFound from "@/components/notfound/NotFound";
import { useSelector } from "react-redux";
import { FiCreditCard, FiPlus } from "react-icons/fi";
import { RiWallet3Line, RiMoneyDollarCircleLine } from "react-icons/ri";
import { LuReceipt } from "react-icons/lu";
import WalletBalanceModal from "./WalletBalanceModal";
import RazorpayLogo from "@/assets/payment_methods_svgs/ic_razorpay.svg";
import StripeLogo from "@/assets/payment_methods_svgs/ic_stripe.svg";
import PaypalLogo from "@/assets/payment_methods_svgs/ic_paypal.svg";
import PaystackLogo from "@/assets/payment_methods_svgs/ic_paystack.svg";
import CashfreeLogo from "@/assets/payment_methods_svgs/ic_cashfree.svg";
import PaytabsLogo from "@/assets/payment_methods_svgs/ic_paytabs.svg";
import PaytmLogo from "@/assets/payment_methods_svgs/ic_paytm.svg";
import PhonePeLogo from "@/assets/payment_methods_svgs/Phonepe.svg";
import MidtransLogo from "@/assets/payment_methods_svgs/Midtrans.svg";

// payment_type (from the API) → brand logo. Wallet/COD have no gateway logo, so
// they fall back to an icon in the row.
const PAYMENT_LOGOS = {
  razorpay: RazorpayLogo,
  stripe: StripeLogo,
  paypal: PaypalLogo,
  paystack: PaystackLogo,
  cashfree: CashfreeLogo,
  paytabs: PaytabsLogo,
  paytm: PaytmLogo,
  phonepe: PhonePeLogo,
  phonepay: PhonePeLogo,
  midtrans: MidtransLogo,
};

const WalletHistory = () => {
  const setting = useSelector((state) => state.Setting.setting);
  const user = useSelector((state) => state.User.user);

  const balance = `${setting?.currency ?? ""}${(user?.balance ?? 0).toFixed(
    setting?.decimal_point ? setting?.decimal_point : 0,
  )}`;

  const [addWalletModal, setAddWalletModal] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [isError, setIsError] = useState(false);
  const didInitialFetch = useRef(false);

  const transactionPerPage = 9;

  const fetchWalletTransaction = async (isLoadMore = false, newOffset) => {
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setIsError(false);
    }
    try {
      const response = await api.getUserTransactions({
        limit: transactionPerPage,
        offset: newOffset,
        type: "wallet",
      });
      if (response.status == 1) {
        setTransactions((trnscn) =>
          isLoadMore ? [...trnscn, ...response.data] : response.data,
        );
        setTotal(response?.total);
        setLoading(false);
        setLoadingMore(false);
      } else {
        setTransactions([]);
        setTotal(0);
        setLoading(false);
        setLoadingMore(false);
      }
    } catch (error) {
      setLoading(false);
      setLoadingMore(false);
      if (!isLoadMore) {
        setIsError(true);
      }
      console.log("Error", error);
    }
  };

  useEffect(() => {
    if (didInitialFetch.current) return;
    didInitialFetch.current = true;
    fetchWalletTransaction(false, 0);
  }, []);

  const handleFetchMore = async () => {
    const newOffset = offset + transactionPerPage;
    setOffset(newOffset);
    fetchWalletTransaction(true, newOffset);
  };

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-bold fontColor">{t("my_wallet")}</h1>

      {/* Top card: balance + recharge in ONE div */}
      <div
        className="relative overflow-hidden p-6 md:p-7 text-white shadow-sm rounded-lg"
        style={{
          backgroundImage:
            "linear-gradient(120deg, var(--primary-color) 0%, color-mix(in srgb, var(--primary-color) 65%, #000) 100%)",
        }}
      >
        <span className="pointer-events-none absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
        <span className="pointer-events-none absolute -bottom-16 -left-8 w-48 h-48 rounded-full bg-white/5" />

        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
          {/* Balance */}
          <div className="flex items-center gap-4">
            <span className="shrink-0 w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-white/15 backdrop-blur flex items-center justify-center ring-1 ring-white/20">
              <FiCreditCard size={28} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider opacity-80">
                {t("available_balance")}
              </p>
              <p className="mt-1 text-3xl md:text-4xl font-extrabold tracking-tight tabular-nums">
                {balance}
              </p>
            </div>
          </div>

          {/* Recharge action */}
          <button
            type="button"
            onClick={() => setAddWalletModal(true)}
            className="group shrink-0 flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 font-bold primaryColor shadow-sm transition-all hover:shadow-md active:scale-[0.98]"
          >
            <span className="flex items-center justify-center transition-transform group-hover:rotate-90">
              <FiPlus size={20} />
            </span>
            {t("recharge_wallet")}
          </button>
        </div>
      </div>

      {/* Transactions table */}
      <div className="rounded-xl border cardBorder overflow-hidden bg-white dark:bg-zinc-900">
        {!loading && isError ? (
          <div className="grid place-items-center gap-3 py-10 text-center">
            <p className="font-semibold text-base fontColor">
              {t("something_went_wrong") || "Something went wrong"}
            </p>
            <button
              className="rounded-lg primaryBackColor py-2 px-5 text-white text-sm font-medium"
              onClick={() => fetchWalletTransaction(false, 0)}
            >
              {t("retry") || t("try_again") || "Retry"}
            </button>
          </div>
        ) : !loading && transactions?.length === 0 ? (
          <NotFound image={NoTransactionFound} title={t("no_transaction")} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-4 md:p-5">
            {loading
              ? Array?.from({ length: 6 })?.map((_, index) => (
                  <div
                    key={index}
                    className="flex h-full items-center gap-3.5 rounded-xl border cardBorder p-4"
                  >
                    <span className="h-10 w-10 shrink-0 rounded-full bg-gray-200 dark:bg-zinc-800 animate-pulse" />
                    <div className="flex-grow space-y-2">
                      <span className="block h-3.5 w-1/2 rounded bg-gray-200 dark:bg-zinc-800 animate-pulse" />
                      <span className="block h-3 w-1/3 rounded bg-gray-200 dark:bg-zinc-800 animate-pulse" />
                    </div>
                    <span className="h-4 w-16 rounded bg-gray-200 dark:bg-zinc-800 animate-pulse" />
                  </div>
                ))
              : transactions?.map((transaction) => {
                  const isCredit = transaction?.type == "credit";
                  const payType = transaction?.payment_type || "";
                  const logo = PAYMENT_LOGOS[payType.toLowerCase()];
                  const isWalletPay = payType.toLowerCase() === "wallet";
                  return (
                    <div
                      key={transaction?.id}
                      className="flex h-full items-start gap-3.5 rounded-xl border cardBorder p-4 transition-all hover:shadow-sm hover:primaryColorBorder"
                    >
                      {/* gateway logo (recharge) or wallet/cash icon (order/wallet) */}
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border cardBorder bg-white dark:bg-zinc-800">
                        {logo ? (
                          <Image
                            src={logo}
                            alt={payType}
                            width={28}
                            height={28}
                            className="h-6 w-auto object-contain"
                          />
                        ) : isWalletPay ? (
                          <RiWallet3Line size={20} className="primaryColor" />
                        ) : (
                          <RiMoneyDollarCircleLine
                            size={20}
                            className="primaryColor"
                          />
                        )}
                      </span>

                      {/* left: payment type + txn id + message + date */}
                      <div className="min-w-0 flex-grow">
                        <p className="truncate font-bold fontColor capitalize leading-tight">
                          {payType || (isCredit ? t("credit") : t("debit"))}
                        </p>
                        {transaction?.txn_id && (
                          <p
                            className="mt-0.5 truncate text-[11px] font-medium SecondaryTextColor"
                            title={transaction?.txn_id}
                          >
                            {t("txn_id") || "TXN ID"}: {transaction.txn_id}
                          </p>
                        )}
                        <p
                          className="mt-0.5 truncate text-xs SecondaryTextColor"
                          title={transaction?.message}
                        >
                          {transaction?.message}
                        </p>
                        <p className="mt-1 text-[11px] SecondaryTextColor">
                          {formatCustomDate(transaction?.created_at)}
                        </p>
                      </div>

                      {/* right: badge + amount, grouped together (no mid-row gap) */}
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                            isCredit
                              ? "bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400"
                              : "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                          }`}
                        >
                          {isCredit ? t("credit") : t("debit")}
                        </span>
                        <p
                          className={`text-base font-extrabold whitespace-nowrap tabular-nums ${
                            isCredit
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {isCredit ? "+" : "-"}
                          {transaction?.currency || setting?.currency}
                          {transaction?.amount?.toFixed(
                            setting?.decimal_point ? setting?.decimal_point : 0,
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}

            {loadingMore &&
              Array?.from({ length: 3 })?.map((_, index) => (
                <div
                  key={`more-${index}`}
                  className="flex items-center gap-3.5 rounded-xl border cardBorder p-4"
                >
                  <span className="h-10 w-10 shrink-0 rounded-full bg-gray-200 dark:bg-zinc-800 animate-pulse" />
                  <div className="flex-grow space-y-2">
                    <span className="block h-3.5 w-1/2 rounded bg-gray-200 dark:bg-zinc-800 animate-pulse" />
                    <span className="block h-3 w-1/3 rounded bg-gray-200 dark:bg-zinc-800 animate-pulse" />
                  </div>
                  <span className="h-4 w-16 rounded bg-gray-200 dark:bg-zinc-800 animate-pulse" />
                </div>
              ))}
          </div>
        )}

        {total > transactions?.length && (
          <div className="flex justify-center p-4 border-t border-[color:var(--border-color)]">
            <button
              className="primaryColor primaryColorBorder border font-semibold text-sm px-6 py-2.5 rounded-full transition-colors hover:primaryBackColor hover:text-white"
              onClick={handleFetchMore}
            >
              {t("load_more")}
            </button>
          </div>
        )}
      </div>

      <WalletBalanceModal
        addWalletModal={addWalletModal}
        setAddWalletModal={setAddWalletModal}
        type="wallet"
      />
    </div>
  );
};

export default WalletHistory;
