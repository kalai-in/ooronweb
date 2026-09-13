import type { Metadata } from "next";
import { generateCategoriesMetadata, CategoriesIndexBody } from "@/app/_shared/categoriesPageLogic";

type Params = Promise<{ lang: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { lang } = await params;
  return generateCategoriesMetadata(lang, null);
}

export default async function CategoriesIndexRoute({ params }: { params: Params }) {
  const { lang } = await params;
  return <CategoriesIndexBody lang={lang} zone={null} />;
}
