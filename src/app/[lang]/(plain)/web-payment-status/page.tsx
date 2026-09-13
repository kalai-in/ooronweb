import type { Metadata } from "next";
import PaymentStatusPage from "@/components/pagecomponents/PaymentStatusPage";
import { buildPageMetadata } from "@/utils/buildMetadata";

export const metadata: Metadata = buildPageMetadata({
  title: `Payment Status - ${process.env.NEXT_PUBLIC_META_TITLE}`,
  pageName: "/web-payment-status",
  robots: "noindex, nofollow",
});

export default function WebPaymentStatusRoute() {
  return <PaymentStatusPage />;
}
