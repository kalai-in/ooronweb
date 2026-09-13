import type { Metadata } from "next";
import ActiveOrdersPage from "@/components/pagecomponents/ActiveOrdersPage";
import { buildPageMetadata } from "@/utils/buildMetadata";

export const metadata: Metadata = buildPageMetadata({
  title: `Active Orders - ${process.env.NEXT_PUBLIC_META_TITLE}`,
  pageName: "/profile/active-orders",
  robots: "noindex, nofollow",
});

export default function ActiveOrdersRoute() {
  return <ActiveOrdersPage />;
}
