import type { Metadata } from "next";
import CheckoutPage from "@/components/pagecomponents/CheckoutPage";
import { buildPageMetadata } from "@/utils/buildMetadata";

export const metadata: Metadata = buildPageMetadata({
  title: `Checkout - ${process.env.NEXT_PUBLIC_META_TITLE}`,
  pageName: "/checkout",
  robots: "noindex, nofollow",
});

export default function CheckoutRoute() {
  return <CheckoutPage />;
}
