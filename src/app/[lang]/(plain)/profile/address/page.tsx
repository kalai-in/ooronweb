import type { Metadata } from "next";
import AddressPage from "@/components/pagecomponents/AddressPage";
import { buildPageMetadata } from "@/utils/buildMetadata";

export const metadata: Metadata = buildPageMetadata({
  title: `Address - ${process.env.NEXT_PUBLIC_META_TITLE}`,
  pageName: "/profile/address",
  robots: "noindex, nofollow",
});

export default function AddressRoute() {
  return <AddressPage />;
}
