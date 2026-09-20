import type { Metadata } from "next";
import WishlistPage from "@/components/pagecomponents/WishlistPage";
import { buildPageMetadata } from "@/utils/buildMetadata";

export const metadata: Metadata = buildPageMetadata({
  title: `Wishlist - ${process.env.NEXT_PUBLIC_META_TITLE}`,
  pageName: "/profile/wishlist",
  robots: "noindex, nofollow",
});

export default function WishlistRoute() {
  return <WishlistPage />;
}
