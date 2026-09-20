import type { Metadata } from "next";
import OrderHistoryPage from "@/components/pagecomponents/OrderHistoryPage";
import { buildPageMetadata } from "@/utils/buildMetadata";

export const metadata: Metadata = buildPageMetadata({
  title: `Order History - ${process.env.NEXT_PUBLIC_META_TITLE}`,
  pageName: "/profile/order-history",
  robots: "noindex, nofollow",
});

export default function OrderHistoryRoute() {
  return <OrderHistoryPage />;
}
