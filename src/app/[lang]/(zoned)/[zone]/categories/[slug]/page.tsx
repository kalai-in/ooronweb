import type { Metadata } from "next";
import { generateCategoryMetadata, CategoryPageBody } from "@/app/_shared/categoryPageLogic";

type Params = Promise<{ lang: string; zone: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang, zone, slug } = await params;
  return generateCategoryMetadata(slug, lang, zone);
}

export default async function ZoneCategorySlugRoute({ params }: { params: Params }) {
  const { lang, zone, slug } = await params;
  return <CategoryPageBody slug={slug} lang={lang} zone={zone} />;
}
