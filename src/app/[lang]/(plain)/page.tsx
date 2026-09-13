import type { Metadata } from "next";
import { generateHomeMetadata, HomePageBody } from "@/app/_shared/homePageLogic";

type Params = Promise<{ lang: string }>;
type SearchParams = Promise<{ tab?: string }>;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { lang } = await params;
  const { tab } = await searchParams;
  return generateHomeMetadata(lang, null, typeof tab === "string" ? tab : null);
}

export default async function HomeRoute({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { lang } = await params;
  const { tab } = await searchParams;
  return <HomePageBody lang={lang} zone={null} tabSlugParam={typeof tab === "string" ? tab : null} />;
}
