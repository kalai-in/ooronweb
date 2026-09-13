import type { Metadata } from "next";
import CartPage from "@/components/pagecomponents/CartPage";
import { buildPageMetadata } from "@/utils/buildMetadata";

export const metadata: Metadata = buildPageMetadata({
  title: `Cart - ${process.env.NEXT_PUBLIC_META_TITLE}`,
  pageName: "/cart",
  robots: "noindex, nofollow",
});

export default function CartRoute() {
  return <CartPage />;
}
