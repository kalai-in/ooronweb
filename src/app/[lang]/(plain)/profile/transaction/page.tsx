import type { Metadata } from "next";
import TransactionHistoryPage from "@/components/pagecomponents/TransactionHistoryPage";
import { buildPageMetadata } from "@/utils/buildMetadata";

export const metadata: Metadata = buildPageMetadata({
  title: `Transactions - ${process.env.NEXT_PUBLIC_META_TITLE}`,
  pageName: "/profile/transactions",
  robots: "noindex, nofollow",
});

export default function TransactionRoute() {
  return <TransactionHistoryPage />;
}
