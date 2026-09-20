import type { Metadata } from "next";
import { generateCategoryMetadata, CategoryPageBody } from "@/app/_shared/categoryPageLogic";

type Params = Promise<{ lang: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang, slug } = await params;
  return generateCategoryMetadata(slug, lang, null);
}

export default async function CategorySlugRoute({ params }: { params: Params }) {
  const { lang, slug } = await params;
  return <CategoryPageBody slug={slug} lang={lang} zone={null} />;
}
