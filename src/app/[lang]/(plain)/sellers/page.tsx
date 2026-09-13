import type { Metadata } from "next";
import SellersPage from "@/components/pagecomponents/SellersPage";
import { buildPageMetadata } from "@/utils/buildMetadata";

export const metadata: Metadata = buildPageMetadata({
  title: `Sellers - ${process.env.NEXT_PUBLIC_META_TITLE}`,
  pageName: "/sellers",
});

export default function SellersRoute() {
  return <SellersPage />;
}
