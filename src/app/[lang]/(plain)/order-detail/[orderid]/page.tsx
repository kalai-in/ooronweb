import type { Metadata } from "next";
import OrderDetailPage from "@/components/pagecomponents/OrderDetailPage";
import { buildPageMetadata } from "@/utils/buildMetadata";

export const metadata: Metadata = buildPageMetadata({
  title: `Order Details - ${process.env.NEXT_PUBLIC_META_TITLE}`,
  pageName: "/order-detail/",
  robots: "noindex, nofollow",
});

export default function OrderDetailRoute() {
  return <OrderDetailPage />;
}
