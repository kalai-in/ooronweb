import type { Metadata } from "next";
import { generateCategoriesMetadata, CategoriesIndexBody } from "@/app/_shared/categoriesPageLogic";

type Params = Promise<{ lang: string; zone: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang, zone } = await params;
  return generateCategoriesMetadata(lang, zone);
}

export default async function ZoneCategoriesIndexRoute({ params }: { params: Params }) {
  const { lang, zone } = await params;
  return <CategoriesIndexBody lang={lang} zone={zone} />;
}
