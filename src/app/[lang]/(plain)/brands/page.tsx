import type { Metadata } from "next";
import BrandsPage from "@/components/pagecomponents/BrandsPage";
import { buildPageMetadata } from "@/utils/buildMetadata";

export const metadata: Metadata = buildPageMetadata({
  title: `Brands - ${process.env.NEXT_PUBLIC_META_TITLE}`,
  pageName: "/brands",
});

export default function BrandsRoute() {
  return <BrandsPage />;
}
