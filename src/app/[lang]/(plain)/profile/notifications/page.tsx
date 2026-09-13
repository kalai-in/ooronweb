import type { Metadata } from "next";
import NotificationsPage from "@/components/pagecomponents/NotificationsPage";
import { buildPageMetadata } from "@/utils/buildMetadata";

export const metadata: Metadata = buildPageMetadata({
  title: `Notifications - ${process.env.NEXT_PUBLIC_META_TITLE}`,
  pageName: "/profile/notifications",
  robots: "noindex, nofollow",
});

export default function NotificationsRoute() {
  return <NotificationsPage />;
}
