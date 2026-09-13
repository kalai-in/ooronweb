import type { Metadata } from "next";
import ResetPasswordPage from "@/components/pagecomponents/ResetPasswordPage";
import { buildPageMetadata } from "@/utils/buildMetadata";

export const metadata: Metadata = buildPageMetadata({
  title: "Reset Password",
  pageName: "/profile/reset-password",
  robots: "noindex, nofollow",
});

export default function ResetPasswordRoute() {
  return <ResetPasswordPage />;
}
