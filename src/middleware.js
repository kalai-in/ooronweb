import { NextResponse } from "next/server";
import { isZoneCandidate } from "@/utils/reservedRoutes";
import { getEdgeLanguages } from "@/utils/languageEdge";

// Localized, zone-prefixed URLs are rewritten onto the real routes, carrying the
// language and zone as query params. The public URL is unchanged; the underlying
// page count stays flat (one product page, one home, one listing).
//
//   /ur/bhuj-quick/product/tomato  ->  /product/tomato?lang=ur&zone=bhuj-quick
//   /bhuj-quick/product/tomato     ->  /product/tomato?zone=bhuj-quick
//   /ur/products                   ->  /products?lang=ur
//
// The default language (en) is NEVER a segment — /bhuj-quick, not /en/bhuj-quick
// (see languageRoutes.js). Order matters: language is the OUTERMOST segment, so
// it's stripped first, then the remainder is the same zone logic as before.
//
// Rewrite, not redirect: getServerSideProps reads lang+zone and resolves them.
// NO network calls here — this runs on every request.

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const segments = pathname.split("/").filter(Boolean);

  if (segments.length < 1) return NextResponse.next();

  // 1. Strip an optional leading language segment. Language codes come from the
  //    API (admins add languages at runtime), cached per edge instance — so the
  //    default language is NOT a valid prefix (its canonical is un-prefixed).
  const { codes, defaultCode } = await getEdgeLanguages();
  let lang = null;
  let rest = segments;
  if (segments[0] !== defaultCode && codes.has(segments[0])) {
    lang = segments[0];
    rest = segments.slice(1);
  }

  // 2. What remains is [zone?, ...route]. A bare /ur (language only) falls
  //    through to routeSegments = [] below, i.e. the localized home.
  let zone = null;
  let routeSegments = rest;
  if (rest.length >= 1 && isZoneCandidate(rest[0])) {
    zone = rest[0];
    routeSegments = rest.slice(1);
  }

  // Nothing localized and nothing zoned — an ordinary route, leave it.
  if (!lang && !zone) return NextResponse.next();

  // 3. Language may prefix ANY route (/ur/cart, /ur/profile) — otherwise
  //    navigating to an unprefixed page resets the UI to the default language,
  //    since the URL is the source of truth. Auth/funnel pages are noindex, so
  //    a localized variant carries no duplicate-content risk.
  //
  //    ZONE is different: only migrated shapes accept it, because a zone URL
  //    promises location-specific content. An unmigrated route under a zone
  //    prefix falls through to a 404 rather than silently serving the wrong
  //    location.
  if (zone) {
    const isHome = routeSegments.length === 0;
    const isProduct =
      routeSegments[0] === "product" && routeSegments.length === 2;
    const isProducts =
      routeSegments[0] === "products" && routeSegments.length === 1;
    // Bare /{zone}/product (no slug) mirrors the bare /product stub, which
    // redirects to the listing. Without this it 404s — the breadcrumb's
    // "Product" crumb points there.
    const isProductStub =
      routeSegments[0] === "product" && routeSegments.length === 1;
    // /{zone}/categories and /{zone}/categories/{slug}. Category listings are
    // location-specific (a zone only stocks some categories), so they earn a
    // zone the same way /products does.
    const isCategories =
      routeSegments[0] === "categories" && routeSegments.length <= 2;
    // BLOG is NOT zone-prefixable: an article reads identically in every zone,
    // so a zone segment only forked one piece of content across N URLs. Links
    // are now emitted zone-less (see ZONE_PREFIXABLE in zoneUrl.js).
    //
    // Old /{zone}/blog/... links are already shared in the wild, so redirect
    // them to the canonical zone-less URL instead of letting them 404. The
    // language segment is kept — that one still changes the content.
    const isBlogList =
      routeSegments[0] === "blogs" && routeSegments.length === 1;
    const isBlog = routeSegments[0] === "blog" && routeSegments.length === 2;
    if (isBlogList || isBlog) {
      const target = request.nextUrl.clone();
      target.pathname = `${lang ? `/${lang}` : ""}/${routeSegments.join("/")}`;
      return NextResponse.redirect(target, 308);
    }
    if (
      !isHome &&
      !isProduct &&
      !isProducts &&
      !isProductStub &&
      !isCategories
    ) {
      return NextResponse.next();
    }
  }

  // clone() preserves existing search params (listing filters survive); only
  // lang and zone are added.
  const url = request.nextUrl.clone();
  url.pathname = routeSegments.length ? `/${routeSegments.join("/")}` : "/";
  if (lang) url.searchParams.set("lang", lang);
  if (zone) url.searchParams.set("zone", zone);
  return NextResponse.rewrite(url);
}

export const config = {
  // Skip framework internals and static files outright — cheaper than entering
  // the middleware body for every asset request.
  matcher: ["/((?!_next/static|_next/image|_next/data|favicon.ico|.*\\..*).*)"],
};

