import type { Metadata } from "next";
import SubscriptionPage from "@/components/pagecomponents/SubscriptionPage";
import { buildPageMetadata } from "@/utils/buildMetadata";

export const metadata: Metadata = buildPageMetadata({
  title: `Subscription - ${process.env.NEXT_PUBLIC_META_TITLE}`,
  // pageName kept exactly as the original (a pre-existing copy-paste value,
  // not "/profile/subscription") — preserving behavior, not fixing it here.
  pageName: "/profile/order-history",
  robots: "noindex, nofollow",
});

export default function SubscriptionRoute() {
  return <SubscriptionPage />;
}
