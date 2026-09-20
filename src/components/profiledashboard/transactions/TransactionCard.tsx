import React from 'react'
import Image from 'next/image'
import { t } from "@/utils/translation"
import { formatCustomDate } from "@/lib/utils"
import { formatCurrency } from "@/utils/helperFunction"
import { LuReceipt } from "react-icons/lu"

import CashfreeImage from "@/assets/payment_methods_svgs/ic_cashfree.svg";
import RazorpayImage from "@/assets/payment_methods_svgs/ic_razorpay.svg";
import PaypalImage from "@/assets/payment_methods_svgs/ic_paypal.svg";
import PaystackImage from "@/assets/payment_methods_svgs/ic_paystack.svg";
import StriperImage from "@/assets/payment_methods_svgs/ic_stripe.svg";
import MidtransImage from "@/assets/payment_methods_svgs/Midtrans.svg";
import PhonePeImage from "@/assets/payment_methods_svgs/Phonepe.svg";
import PaytabsImage from "@/assets/payment_methods_svgs/ic_paytabs.svg";
import useCurrency from "@/hooks/useCurrency"

// Keyed lowercase so lookup is case-insensitive — the API sends "PhonePe",
// "Razorpay" etc. with inconsistent casing, which previously missed the icon.
const PAYMENT_ICONS: Record<string, any> = {
    razorpay: RazorpayImage,
    paypal: PaypalImage,
    paystack: PaystackImage,
    stripe: StriperImage,
    cashfree: CashfreeImage,
    midtrans: MidtransImage,
    phonepe: PhonePeImage,
    paytabs: PaytabsImage,
};

interface TransactionCardProps {
    transaction: any;
}

const TransactionCard = ({ transaction }: TransactionCardProps) => {
    const isSuccess = transaction?.status == "success";
    const icon = PAYMENT_ICONS[String(transaction?.type || "").toLowerCase()];
    // Transaction currency is a historical fact (paid in this currency at the
    // time) — must not drift with the viewer's current zone.
    const { currency, decimals } = useCurrency(transaction);
    const amount = formatCurrency(transaction?.amount, currency, decimals);

    return (
        <div className='col-span-12 lg:col-span-6'>
            <div className="m-1.5 flex items-center gap-3 rounded-xl border cardBorder bg-white dark:bg-zinc-900 p-3 transition hover:shadow-sm">
                {/* Payment icon */}
                <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border cardBorder bg-white p-1'>
                    {icon ? (
                        <Image
                            src={icon}
                            alt={transaction?.type || "payment"}
                            className="h-full w-full object-contain"
                            height={40}
                            width={40}
                            unoptimized
                        />
                    ) : (
                        <LuReceipt size={18} className="SecondaryTextColor" />
                    )}
                </div>

                {/* Method + date */}
                <div className="min-w-0 flex-grow">
                    <p className="truncate text-sm font-bold textColor capitalize">
                        {transaction?.type}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] SecondaryTextColor">
                        <span className="shrink-0">#{transaction?.id}</span>
                        <span className="h-0.5 w-0.5 shrink-0 rounded-full bg-current opacity-60" />
                        <span className="whitespace-nowrap">{formatCustomDate(transaction?.created_at)}</span>
                    </p>
                </div>

                {/* Amount + status */}
                <div className="shrink-0 text-right">
                    <p className="text-base font-extrabold textColor leading-none">
                        {amount}
                    </p>
                    <span
                        className={`mt-1 inline-flex items-center gap-1 text-[11px] font-semibold ${
                            isSuccess ? "text-green-600" : "text-red-600"
                        }`}
                    >
                        <span className={`h-1.5 w-1.5 rounded-full ${isSuccess ? "bg-green-500" : "bg-red-500"}`} />
                        {isSuccess ? t("success") : t("failed")}
                    </span>
                </div>
            </div>
        </div>
    )
}

export default TransactionCard
