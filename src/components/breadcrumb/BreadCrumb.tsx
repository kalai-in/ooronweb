"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useDispatch } from "react-redux";
import { t } from "@/utils/translation";
import { Home, ChevronRight } from "lucide-react";
import useLanguages from "@/hooks/useLanguages";
import useZoneHref from "@/hooks/useZoneHref";
import { parseZonePath } from "@/utils/zoneUrl";
import {
  setListingSource,
  setCategorySlug,
  setBlockSource,
} from "@/redux/slices/productFilterSlice";
import useUrlProductFilters from "@/hooks/useUrlProductFilters";

interface BreadCrumbProps {
  title?: string;
  categoryId?: number | string | null;
  categorySlug?: string;
}

interface Crumb {
  label: string;
  href: string;
}

// On a product page, pass categoryId/categorySlug so the "Product" crumb opens
// the product listing pre-filtered to that product's category.
const BreadCrumb = ({ title, categoryId, categorySlug }: BreadCrumbProps) => {
  const router = useRouter();
  const pathname = usePathname();
  const dispatch = useDispatch();
  const { parseLangPath } = useLanguages();
  const zoneHref = useZoneHref();
  const { buildQueryPatch } = useUrlProductFilters();
  const [breadcrumbs, setBreadcrumbs] = useState<Crumb[]>([]);
  useEffect(() => {
    if (pathname) {
      // Drop the language segment: it's a URL locale marker (/fr/...), not a
      // navigable crumb. hrefs are still built off the full path (with the
      // language prefix re-added) so links keep the current language. The
      // zone segment is intentionally kept.
      const { rest: pathArray, lang } = parseLangPath(pathname);
      const langPrefix = lang ? `/${lang}` : "";
      const formattedBreadcrumbs = pathArray.map((path, index) => {
        const href = `${langPrefix}/${pathArray.slice(0, index + 1).join("/")}`;
        return { label: decodeURIComponent(path), href };
      });

      if (title && formattedBreadcrumbs.length > 0) {
        formattedBreadcrumbs[formattedBreadcrumbs.length - 1].label = title;
      }

      // eslint-disable-next-line react-hooks/set-state-in-effect -- derives breadcrumbs from router path + title
      setBreadcrumbs(formattedBreadcrumbs);
    }
  }, [pathname, title, parseLangPath]);

  const handleNotFoundRoutes = (href: string) => {
    // hrefs carry /{lang}/{zone} prefixes, so compare against the ROUTE part
    // only — otherwise "/bhuj-quick/product" never matches "/product" and the
    // crumb navigates to a URL with no listing behind it.
    const { rest: afterLang } = parseLangPath(href);
    const { rest: routeParts } = parseZonePath("/" + afterLang.join("/"));
    const route = `/${routeParts.join("/")}`;

    if (route === "/product") {
      // From a product page, open /products filtered to the product's category.
      let query = {};
      if (categoryId != null && categorySlug) {
        dispatch(setListingSource({ data: "category" }));
        dispatch(setCategorySlug({ data: categorySlug }));
        // Clears any stale data_source/block_source_id from an earlier "See
        // All" block click — see ProductFilter.jsx's handleCategoryChange /
        // Category.jsx / CategorySection.jsx for the same fix.
        dispatch(setBlockSource());
        query = buildQueryPatch({ category_id: categorySlug });
      }
      // zoneHref re-applies the current lang/zone, so the listing stays in the
      // user's language and location.
      const qs = new URLSearchParams(query).toString();
      const dest = zoneHref("/products");
      return router.push(qs ? `${dest}?${qs}` : dest);
    }
    if (route === "/blog") {
      return router.push(zoneHref("/blogs"));
    }
    if (route === "/categories") {
      return router.push(zoneHref("/categories/all"));
    }
    // The "Order Detail" crumb has no listing page of its own. It used to
    // router.back(), but that follows browser history — so arriving from the
    // payment-success page sent the user BACK to that success screen instead of
    // to their orders. Go to the orders list deterministically instead (same
    // target as the header "My Orders" and the success page's own button).
    if (route === "/order-detail") {
      return router.push(zoneHref("/profile/activeorders"));
    }
    return router.push(href);
  };

  const formatBreadcrumbLabel = (label: string) => {
    const map: Record<string, string> = {
      activeorders: t("active_orders"),
      orderhistory: t("order_history"),
      wallethistory: t("wallet_history"),
      "about-us": t("about_us"),
      "contact-us": t("contact_us"),
      categories: t("categories"),
      products: t("products"),
      blogs: t("blogs"),
      profile: t("profile"),
      all: t("all"),
      orders: t("orders"),
      wishlist: t("wishlist"),
      address: t("address"),
      subscription: t("subscription"),
      transaction: t("transaction"),
      notifications: t("notifications"),
      "notification-setting": t("notification-setting"),
      faqs: t("faqs"),
      "terms-and-conditions": t("terms-and-conditions"),
      active_orders: t("active_orders"),
      "privacy-policy": t("privacy-policy"),
      "return-and-exchange-policy": t("return-and-exchange-policy"),
      "shipping-policy": t("shipping-policy"),
      "cancellation-policy": t("cancellation-policy"),
      cart: t("cart"),
      checkout: t("checkout"),
      "order-detail": t("order-detail"),
      product: t("product"),
      blog: t("blog"),
      brands: t("brands"),
      countries: t("countries"),
    };

    if (map[label]) return map[label];

    return label
      .replaceAll("-", " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  };

  return (
    <section>
      <div className="container pt-4 md:pt-5 pb-1">
        <nav aria-label="breadcrumb">
          {/* min-w-0 lets the last crumb's truncate actually engage — without it
              the flex row sizes to content and overflows the container instead. */}
          <ol className="flex min-w-0 items-center text-sm whitespace-nowrap">
            <li className="flex items-center shrink-0">
              <Link
                href={zoneHref("/")}
                aria-label={t("home")}
                className="flex items-center gap-1.5 capitalize transition-colors hover:primaryColor breadCrumbTrailLink"
              >
                <Home size={15} className="shrink-0" />
                {t("home")}
              </Link>
            </li>

            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <li
                  key={crumb.href}
                  className={`items-center ${
                    isLast
                      ? "flex min-w-0 flex-1"
                      : // Intermediate crumbs are hidden on phones. A product
                        // trail reads Home > Zone > Product > {name}, and a long
                        // zone name ("Surat Adajan Qc Zone") is fixed-width here
                        // while the product name is the only shrinkable cell —
                        // so the name collapsed to "Yu...". Full trail returns
                        // at sm, where there is room for it.
                        "hidden shrink-0 sm:flex"
                  }`}
                >
                  <ChevronRight
                    size={15}
                    className="mx-1.5 shrink-0 opacity-40 rtl:rotate-180"
                    aria-hidden="true"
                  />
                  {isLast ? (
                    <span
                      aria-current="page"
                      className="truncate font-semibold capitalize primaryColor"
                      title={crumb.label}
                    >
                      {formatBreadcrumbLabel(crumb.label)}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleNotFoundRoutes(crumb.href)}
                      className="capitalize transition-colors hover:primaryColor breadCrumbTrailLink"
                      title={crumb.label}
                    >
                      {formatBreadcrumbLabel(crumb.label)}
                    </button>
                  )}
                </li>
              );
            })}
          </ol>
        </nav>
      </div>
    </section>
  );
};

export default BreadCrumb;
