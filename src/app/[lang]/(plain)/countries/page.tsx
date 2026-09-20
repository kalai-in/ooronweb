import type { Metadata } from "next";
import CountriesPage from "@/components/pagecomponents/CountriesPage";
import { buildPageMetadata } from "@/utils/buildMetadata";

export const metadata: Metadata = buildPageMetadata({
  title: `Countries - ${process.env.NEXT_PUBLIC_META_TITLE}`,
  pageName: "/countries",
});

export default function CountriesRoute() {
  return <CountriesPage />;
}
