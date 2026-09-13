import type { Metadata } from "next";
import ProfilePage from "@/components/pagecomponents/ProfilePage";
import { buildPageMetadata } from "@/utils/buildMetadata";

export const metadata: Metadata = buildPageMetadata({
  title: `Profile - ${process.env.NEXT_PUBLIC_META_TITLE}`,
  pageName: "/profile",
  robots: "noindex, nofollow",
});

export default function ProfileRoute() {
  return <ProfilePage />;
}
