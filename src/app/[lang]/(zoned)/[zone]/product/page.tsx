import { redirect } from "next/navigation";
import { buildLocalizedPath } from "@/utils/canonicalUrl";
import { getLanguagesCached } from "@/api/languageResolver";

type Params = Promise<{ lang: string; zone: string }>;

/**
 * Bare /product has no listing of its own — the product listing lives at
 * /products. Redirect so /product no longer 404s, preserving the visitor's
 * zone/language segments exactly as the plain (non-zoned) variant does.
 */
export default async function ZoneProductIndexRedirect({ params }: { params: Params }) {
  const { lang, zone } = await params;
  const { defaultCode } = await getLanguagesCached();
  const dest = buildLocalizedPath({
    lang,
    zone,
    path: "/products",
    defaultCode,
  });
  redirect(dest);
}
