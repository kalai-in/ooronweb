import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { RESERVED_ROUTES } from "@/utils/reservedRoutes";
import { getEdgeLanguages } from "@/utils/languageEdge";

// Real [lang]/[zone] path segments now — no more rewrite-to-query-param. The
// route tree itself (src/app/[lang]/(zoned)/[zone]/... vs .../[lang]/(plain)/...)
// resolves zone-vs-plain routes natively via Next's own static-beats-dynamic
// route matching, so this file's job shrinks to two things a route matcher
// can't do on its own:
//
//   1. The default language is never a VISIBLE URL prefix (/bhuj-quick, not
//      /en/bhuj-quick) but [lang] is a required segment in the route tree —
//      so a request with no (or an explicit default) language segment needs
//      its internal routing target adjusted without changing the address bar:
//        /products            -> (rewrite) -> /en/products
//        /bhuj-quick/products -> (rewrite) -> /en/bhuj-quick/products
//        /en/products         -> (308 redirect) -> /products   (canonical collapse)
//
//   2. Old /{zone}/blog/... links are shared in the wild. blog/blogs are NOT
//      zone-prefixable (an article reads identically in every zone), so these
//      redirect to the zone-less canonical instead of 404ing against a route
//      tree that has no [zone]/blog folder.
//
// Zone EXISTENCE is never checked here (unchanged from before) — that stays
// each page's job via resolveZoneBySlug, which 404s (as inline Custom404 at
// HTTP 200, an intentional, previously-made trade-off) on an unresolvable slug.
// This file only ever looks at URL SHAPE, never calls the zones API.

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const segments = pathname.split("/").filter(Boolean);

  const { codes, defaultCode } = await getEdgeLanguages();

  const first = segments[0];
  const hasExplicitLang = !!first && codes.has(first);

  // Explicit default-language segment (/en/...) is a duplicate of the
  // canonical zone-less URL — collapse it with a real redirect (not rewrite),
  // stripping just that one segment.
  if (hasExplicitLang && first === defaultCode) {
    const target = request.nextUrl.clone();
    target.pathname = segments.length > 1 ? `/${segments.slice(1).join("/")}` : "/";
    return NextResponse.redirect(target, 308);
  }

  // Everything after an optional explicit non-default language segment.
  const rest = hasExplicitLang ? segments.slice(1) : segments;

  // Old /{zone}/blog/... and /{zone}/blogs links: redirect to the zone-less
  // canonical, keeping any explicit language segment (that one still changes
  // the content). Only fires when rest[0] is NOT a reserved route name, i.e.
  // it's shaped like a zone slug sitting in front of blog/blogs.
  if (
    rest.length >= 2 &&
    (rest[1] === "blog" || rest[1] === "blogs") &&
    rest[0] &&
    !RESERVED_ROUTES.has(rest[0])
  ) {
    const target = request.nextUrl.clone();
    const langPrefix = hasExplicitLang ? `/${first}` : "";
    target.pathname = `${langPrefix}/${rest.slice(1).join("/")}`;
    return NextResponse.redirect(target, 308);
  }

  // Already has an explicit, real (non-default) language segment — matches
  // [lang]/... natively, nothing to rewrite.
  if (hasExplicitLang) return NextResponse.next();

  // No language segment at all (or one that isn't a recognized code) — rewrite
  // internally so Next's router has a [lang] value to match, without changing
  // the visible URL. clone() preserves existing search params (listing filters
  // survive) — this is the only param this file still ever injects.
  const url = request.nextUrl.clone();
  url.pathname = `/${defaultCode}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Skip framework internals and static files outright — cheaper than entering
  // the proxy body for every asset request.
  matcher: ["/((?!_next/static|_next/image|_next/data|favicon.ico|.*\\..*).*)"],
};
