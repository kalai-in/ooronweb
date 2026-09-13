import type { Metadata } from "next";
import WalletHistoryPage from "@/components/pagecomponents/WalletHistoryPage";
import { buildPageMetadata } from "@/utils/buildMetadata";

export const metadata: Metadata = buildPageMetadata({
  title: `Wallet History - ${process.env.NEXT_PUBLIC_META_TITLE}`,
  pageName: "/profile/wallet-history",
  robots: "noindex, nofollow",
});

export default function WalletHistoryRoute() {
  return <WalletHistoryPage />;
}
