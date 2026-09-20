import type { Metadata } from "next";
import { generateHomeMetadata, HomePageBody } from "@/app/_shared/homePageLogic";

type Params = Promise<{ lang: string; zone: string }>;
type SearchParams = Promise<{ tab?: string }>;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { lang, zone } = await params;
  const { tab } = await searchParams;
  return generateHomeMetadata(lang, zone, typeof tab === "string" ? tab : null);
}

export default async function ZoneHomeRoute({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { lang, zone } = await params;
  const { tab } = await searchParams;
  return <HomePageBody lang={lang} zone={zone} tabSlugParam={typeof tab === "string" ? tab : null} />;
}
