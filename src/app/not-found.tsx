import Custom404 from "@/components/notfound/Custom404";

// Renders for any route that matches no page in the app — the App Router
// convention for this (replaces src/pages/404.js, which served the same
// role for every unmatched Pages Router route). The zone/slug-rewrite 404
// case (an unresolvable zone reached via middleware) is handled separately,
// inline, by the pages that do that resolution — see product/[slug],
// categories/[slug], blog/[slug], and the home page — since a middleware
// REWRITE bypasses this boundary; both paths render the same Custom404 UI.
export default function NotFound() {
  return <Custom404 />;
}
