import { t } from "@/utils/translation";
import Image from "next/image";
import Link from "next/link";
import React, { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { BiMessageAltDots } from "react-icons/bi";
import { IoLocationOutline, IoChevronForwardOutline } from "react-icons/io5";
import { MdPhoneInTalk } from "react-icons/md";
import { FaXTwitter } from "react-icons/fa6";
import { useSelector, useDispatch } from "react-redux";
import * as api from "@/api/apiRoutes";
import {
  clearAllFilter,
  setCategorySlug,
  setListingSource,
  setSelectedCategories,
  setCategoryBreadcrumb,
} from "@/redux/slices/productFilterSlice";
import { setSelectedCountry } from "@/redux/slices/locationModalSlice";
import { serializeFilterPatch } from "@/utils/urlProductFilters";

import CashOnDeliveryImage from "@/assets/payment_methods_svgs/ic_cod.svg";
import CashfreeImage from "@/assets/payment_methods_svgs/ic_cashfree.svg";
import RazorpayImage from "@/assets/payment_methods_svgs/ic_razorpay.svg";
import PaypalImage from "@/assets/payment_methods_svgs/ic_paypal.svg";
import PaystackImage from "@/assets/payment_methods_svgs/ic_paystack.svg";
import StriperImage from "@/assets/payment_methods_svgs/ic_stripe.svg";
import MidtransImage from "@/assets/payment_methods_svgs/Midtrans.svg";
import PhonePeImage from "@/assets/payment_methods_svgs/Phonepe.svg";
import PaytabsImage from "@/assets/payment_methods_svgs/ic_paytabs.svg";
import useZoneHref from "@/hooks/useZoneHref";
import useIsHydrated from "@/hooks/useIsHydrated";
import useStandalone from "@/hooks/useStandalone";
import { socialIconUrl } from "@/utils/socialIcon";

const paymentMethodsConfig = [
  { key: "cod_payment_method", label: "COD", image: CashOnDeliveryImage },
  { key: "razorpay_payment_method", label: "razorpay", image: RazorpayImage },
  { key: "paypal_payment_method", label: "paypal", image: PaypalImage },
  { key: "paystack_payment_method", label: "paystack", image: PaystackImage },
  { key: "stripe_payment_method", label: "stripe", image: StriperImage },
  { key: "cashfree_payment_method", label: "cashfree", image: CashfreeImage },
  { key: "midtrans_payment_method", label: "midtrans", image: MidtransImage },
  { key: "phonepay_payment_method", label: "phonepe", image: PhonePeImage },
  { key: "paytabs_payment_method", label: "paytabs", image: PaytabsImage },
];

// One footer link row (chevron + label); zoneHref prefixing happens here, not per array entry.
const FooterLink = ({ href, label }: { href: string; label: React.ReactNode }) => {
  const zoneHref = useZoneHref();
  return (
    <li>
      <Link
        href={zoneHref(href)}
        className="flex items-center gap-2 w-fit text-sm opacity-90 hover:opacity-100 hover:primaryColor transition-colors duration-300"
      >
        <IoChevronForwardOutline size={14} className="shrink-0" />
        <span>{label}</span>
      </Link>
    </li>
  );
};

const FooterColumn = ({ title, children }: { title: React.ReactNode; children: React.ReactNode }) => (
  <div className="flex flex-col gap-5">
    <h3 className="font-semibold text-lg pb-3 border-b border-white/15">
      {title}
    </h3>
    <ul className="flex flex-col gap-4">{children}</ul>
  </div>
);

const Footer = () => {
  const zoneHref = useZoneHref();
  // Footer only ever navigates to a DIFFERENT page (/products) with a fresh
  // filter query — it never reads or merges against the CURRENT URL's
  // filters, so it calls serializeFilterPatch directly instead of pulling in
  // useUrlProductFilters (which calls useSearchParams() at render time for
  // state Footer never uses). useSearchParams() forces a Suspense boundary
  // around Footer for Next's static prerendering — Footer renders on every
  // page including Next's own /_not-found shell, so a CSR bailout there
  // could blank real page content it sits alongside (see Layout.tsx/
  // Providers.tsx history, 2026-08-25).
  const buildQueryPatch = (patch: Record<string, any>) => serializeFilterPatch({}, patch);
  const dispatch = useDispatch();
  const router = useRouter();
  const setting = useSelector((state: any) => state?.Setting?.setting);
  // Gate presence blocks (app banner, payment/social rows) on hydration to avoid a #418 mismatch.
  const isHydrated = useIsHydrated();
  const isStandalone = useStandalone();
  // jwtToken is persisted (empty on server) — gate on hydration so account links don't shift after rehydrate.
  const isLoggedInRaw = useSelector((state: any) => !!state?.User?.jwtToken);
  const isLoggedIn = isHydrated && isLoggedInRaw;
  const paymentSettings = useSelector(
    (state: any) => state?.Setting?.payment_setting,
  );

  const enabledPaymentMethods = paymentMethodsConfig.filter(
    (method) =>
      paymentSettings?.[method.key] && paymentSettings?.[method.key] === "1",
  );

  const selectedCountry = useSelector(
    (state: any) => state?.LocationModal?.selectedCountry,
  );
  const city = useSelector((state: any) => state?.City?.city);
  // City coords can settle through more than one value while zone resolution
  // completes (see Header.jsx's fetchCity) — debounce so the query key change
  // collapses to the final value instead of fetching once per intermediate one.
  const [debouncedCity, setDebouncedCity] = useState(city);
  useEffect(() => {
    const id = setTimeout(() => setDebouncedCity(city), 300);
    return () => clearTimeout(id);
  }, [city]);

  // Top footer categories, deduped via React Query cache.
  const { data: categories = [] } = useQuery({
    queryKey: [
      "footer-categories",
      debouncedCity?.latitude,
      debouncedCity?.longitude,
    ],
    queryFn: () =>
      api
        .getCategories({
          slug: "",
          limit: 6,
          offset: 0,
          latitude: debouncedCity.latitude,
          longitude: debouncedCity.longitude,
        })
        .then((res: any) => res?.data || []),
    enabled:
      debouncedCity?.latitude != null && debouncedCity?.longitude != null,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });

  const { data: countries = [] } = useQuery({
    queryKey: ["footer-countries", city?.latitude, city?.longitude],
    queryFn: () =>
      api
        .getCountries({
          limit: 100,
          offset: 0,
          latitude: city?.latitude,
          longitude: city?.longitude,
        })
        .then((res: any) => res?.data || []),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
  });

  const [countryOpen, setCountryOpen] = useState(false);
  const countryRef = useRef<HTMLDivElement | null>(null);
  const countryOptionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Close the country popover on outside click / Escape.
  useEffect(() => {
    if (!countryOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (countryRef.current && !countryRef.current.contains(e.target as Node)) {
        setCountryOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCountryOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    countryOptionRefs.current[0]?.focus();
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [countryOpen]);

  const handleCountryChange = (country: any) => {
    setCountryOpen(false);
    dispatch(setSelectedCountry(country));
  };

  // Arrow-key roving focus + Enter/Space to pick, matching native listbox behavior.
  const handleCountryListKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    const options = countryOptionRefs.current.filter(Boolean) as HTMLButtonElement[];
    const currentIndex = options.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      options[(currentIndex + 1) % options.length]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      options[(currentIndex - 1 + options.length) % options.length]?.focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const country = countries[currentIndex];
      if (country) handleCountryChange(country);
    }
  };

  // handleCategoryClick below navigates to /products filtered by the picked category.
  // 3D tilt: rotates the app image toward the cursor, springs back flat on leave.
  const appImgRef = useRef<HTMLImageElement | null>(null);
  // Cached on enter (not re-read per mousemove) — re-measuring every move
  // forces a synchronous layout recalc against the transform the previous
  // move just wrote (Lighthouse "Forced reflow").
  const appImgRectRef = useRef<DOMRect | null>(null);
  const handleAppImgEnter = () => {
    appImgRectRef.current = appImgRef.current?.getBoundingClientRect() ?? null;
  };
  const handleAppImgMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = appImgRef.current;
    const r = appImgRectRef.current;
    if (!el || !r) return;
    const px = (e.clientX - r.left) / r.width - 0.5; // -0.5..0.5
    const py = (e.clientY - r.top) / r.height - 0.5;
    const max = 14; // deg
    el.style.transform = `perspective(700px) rotateX(${-py * max}deg) rotateY(${px * max}deg) scale(1.06)`;
  };
  const handleAppImgLeave = () => {
    appImgRectRef.current = null;
    const el = appImgRef.current;
    if (el)
      el.style.transform =
        "perspective(700px) rotateX(0deg) rotateY(0deg) scale(1)";
  };

  const handleCategoryClick = (category: any) => {
    dispatch(clearAllFilter({}));
    dispatch(setListingSource({ data: "category" }));
    dispatch(setCategorySlug({ data: category.slug }));
    dispatch(
      setCategoryBreadcrumb({
        data: [
          {
            id: category.id,
            name: category?.translations?.name ?? category?.name,
            slug: category.slug,
          },
        ],
      }),
    );
    dispatch(setSelectedCategories({ data: category.id }));
    const qs = new URLSearchParams(
      buildQueryPatch({ category_id: category.slug }),
    ).toString();
    const dest = zoneHref("/products");
    router.push(qs ? `${dest}?${qs}` : dest);
  };

  // Gated on hydration so server and first client render agree (hidden) — avoids a footer-column-shifting mismatch.
  const present = (val: any) => isHydrated && val !== "";

  const aboutLinks = [
    {
      href: "/about-us",
      label: t("about_us"),
      show: present(setting?.about_us),
    },
    {
      href: "/terms-and-conditions",
      label: t("terms_and_conditions"),
      show: present(setting?.terms_conditions),
    },
    {
      href: "/privacy-policy",
      label: t("privacy_policy"),
      show: present(setting?.privacy_policy),
    },
    { href: "/blogs", label: t("blogs"), show: true },
    {
      href: "/contact-us",
      label: t("contact_us"),
      show: present(setting?.contact_us),
    },
    { href: "/faqs", label: t("faq"), show: true },
  ].filter((l) => l.show);

  const accountLinks = [
    { href: "/profile", label: t("profile"), show: isLoggedIn },
    { href: "/profile/wishlist", label: t("wishlist"), show: isLoggedIn },
    { href: "/profile/orderhistory", label: t("orders"), show: isLoggedIn },
    {
      href: "/return-and-exchange-policy",
      label: t("return_and_exchange_policy"),
      show: present(setting?.returns_and_exchanges_policy),
    },
    {
      href: "/shipping-policy",
      label: t("shipping_policy"),
      show: present(setting?.shipping_policy),
    },
    {
      href: "/cancellation-policy",
      label: t("cancellation_policy"),
      show: present(setting?.cancellation_policy),
    },
  ].filter((l) => l.show !== false);

  // App-download banner: requires an enabled store AND at least one piece of content, or it renders empty.
  const ws = setting?.web_settings;
  const androidEnabled = ws?.is_android_app === "1" && !!ws?.play_store_logo;
  const iosEnabled = ws?.is_ios_app === "1" && !!ws?.ios_store_logo;
  const hasApp =
    isHydrated &&
    !isStandalone && // already installed as an app — don't pitch installing it again
    (androidEnabled || iosEnabled) &&
    (!!ws?.app_download_image || !!ws?.app_title);

  return (
    <>
      {/* App-download banner — narrower, centered card that overlaps the top of
          the full-width footer (mirrors the reference's floating promo box). */}
      {hasApp && (
        <div className="w-full px-4 md:px-8 lg:px-16">
          <div
            className="relative z-10 mx-auto -mb-20 flex max-w-6xl items-center overflow-hidden rounded-3xl px-5 py-7 text-white shadow-2xl md:-mb-28 md:rounded-[2rem] md:px-14 md:py-9"
            style={{
              backgroundImage:
                "linear-gradient(120deg, color-mix(in srgb, var(--primary-color) 90%, #fff), var(--primary-color) 55%, color-mix(in srgb, var(--primary-color) 70%, #000))",
            }}
          >
            {/* Decorative orbs */}
            <span className="pointer-events-none absolute -right-12 -top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
            <span className="pointer-events-none absolute -bottom-20 -left-12 h-56 w-56 rounded-full bg-black/10 blur-3xl" />

            <div className="relative flex w-full flex-col items-center gap-5 text-center md:flex-row md:justify-between md:gap-8 md:text-start">
              {/* Left illustration — skipped entirely when the admin uploaded
                  none. Rendering <Image> with an undefined src produced a broken
                  image icon inside the card. */}
              {!!ws?.app_download_image && (
                <div
                  className="shrink-0 cursor-pointer [perspective:700px]"
                  onMouseEnter={handleAppImgEnter}
                  onMouseMove={handleAppImgMove}
                  onMouseLeave={handleAppImgLeave}
                >
                  <Image
                    ref={appImgRef}
                    src={ws.app_download_image}
                    alt="Download our app"
                    width={280}
                    height={280}
                    unoptimized
                    className="h-auto w-[110px] object-contain transition-transform duration-200 ease-out will-change-transform [transform-style:preserve-3d] sm:w-[150px] md:w-[280px]"
                    quality={95}
                  />
                </div>
              )}

              <div className="max-w-xl">
                {/* Each line is omitted when unset — an empty <h2>/<p> still
                    occupies its margins and left a visible gap in the card. */}
                {!!ws?.app_title && (
                  <h2 className="text-xl font-extrabold leading-tight sm:text-2xl md:text-4xl">
                    {ws.app_title}
                  </h2>
                )}
                {!!ws?.app_short_description && (
                  <p className="mt-3 text-sm opacity-90 md:text-base">
                    {ws.app_short_description}
                  </p>
                )}

                <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5 md:mt-5 md:gap-3 md:justify-start">
                  {androidEnabled && (
                    <Link
                      href={setting?.web_settings?.android_app_url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Google Play" // alt is a filename-ish placeholder, name the link explicitly
                      className="w-[130px] transition-transform duration-300 hover:scale-105 md:w-[160px]"
                    >
                      <Image
                        className="h-auto w-full"
                        width={160}
                        height={48}
                        src={setting?.web_settings?.play_store_logo}
                        alt="playStoreLogo"
                        quality={95}
                      />
                    </Link>
                  )}
                  {iosEnabled && (
                    <Link
                      href={setting?.web_settings?.ios_app_url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="App Store"
                      className="w-[130px] transition-transform duration-300 hover:scale-105 md:w-[160px]"
                    >
                      <Image
                        className="h-auto w-full"
                        width={160}
                        height={48}
                        src={setting?.web_settings?.ios_store_logo}
                        alt="appStoreLogo"
                        quality={95}
                      />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full-width footer. Extra top padding when the banner overlaps it. */}
      <section
        className={`footer w-full text-white ${hasApp ? "pt-24 md:pt-36" : "pt-12 md:pt-16"}`}
      >
        <div className="w-full px-4 md:px-8 lg:px-16">
          <div className="flex flex-col gap-y-10 pb-14 border-b border-white/15 md:flex-row md:flex-wrap md:justify-between md:gap-x-10">
            {/* About */}
            <div className="md:w-[30%] lg:w-auto lg:min-w-[200px]">
              <FooterColumn title={t("about_us")}>
                {aboutLinks.map((link) => (
                  <FooterLink
                    key={link.href}
                    href={link.href}
                    label={link.label}
                  />
                ))}
              </FooterColumn>
            </div>

            {/* Categories */}
            {categories?.length > 0 && (
              <div className="md:w-[30%] lg:w-auto lg:min-w-[200px]">
                <FooterColumn title={t("categories") || "Categories"}>
                  {categories.slice(0, 6).map((category: any) => (
                    <li key={category?.id}>
                      <button
                        type="button"
                        onClick={() => handleCategoryClick(category)}
                        className="flex items-center gap-2 w-fit text-sm opacity-90 hover:opacity-100 hover:primaryColor transition-colors duration-300"
                      >
                        <IoChevronForwardOutline
                          size={14}
                          className="shrink-0"
                        />
                        <span className="text-left">
                          {category?.translations?.name ?? category?.name}
                        </span>
                      </button>
                    </li>
                  ))}
                  <li>
                    <Link
                      href={zoneHref("/categories/all")}
                      className="flex items-center gap-2 w-fit text-sm font-semibold opacity-90 hover:opacity-100 hover:primaryColor transition-colors duration-300"
                    >
                      <IoChevronForwardOutline size={14} className="shrink-0" />
                      <span>{t("view_all") || "View All"}</span>
                    </Link>
                  </li>
                </FooterColumn>
              </div>
            )}

            {/* My Account */}
            <div className="md:w-[30%] lg:w-auto lg:min-w-[200px]">
              <FooterColumn title={t("my_account")}>
                {accountLinks.map((link) => (
                  <FooterLink
                    key={link.href}
                    href={link.href}
                    label={link.label}
                  />
                ))}
              </FooterColumn>
            </div>

            {/* Contact info — capped width since the address is admin-supplied and can be long */}
            <div className="flex flex-col gap-5 min-w-0 md:w-[30%] lg:w-auto lg:min-w-[260px] lg:max-w-[380px]">
              <h3 className="font-semibold text-lg pb-3 border-b border-white/15">
                {t("get_in_touch") || t("contact_us")}
              </h3>
              <div className="flex flex-col gap-5 text-sm">
                {isHydrated && setting?.store_address && (
                  // items-start keeps a wrapped address level with the icon; min-w-0 lets it shrink instead of overflowing.
                  <div className="flex gap-3 items-start min-w-0">
                    <span className="p-3 iconBackgroundColor rounded-lg shrink-0">
                      <IoLocationOutline size={20} className="text-white" />
                    </span>
                    <Link
                      href={`https://maps.google.com/?q=${encodeURIComponent(
                        setting.store_address,
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={setting.store_address}
                      // break-all handles space-free addresses; line-clamp-2 caps length (full text in title).
                      className="min-w-0 break-all line-clamp-2 opacity-90 hover:opacity-100 transition-opacity duration-300"
                    >
                      {setting.store_address}
                    </Link>
                  </div>
                )}
                {isHydrated && setting?.support_number && (
                  <div className="flex gap-3 items-center">
                    <span className="p-3 iconBackgroundColor rounded-lg shrink-0">
                      <MdPhoneInTalk size={20} className="text-white" />
                    </span>
                    <Link
                      href={`tel:${setting?.support_number}`}
                      className="opacity-90 hover:opacity-100 transition-opacity duration-300"
                    >
                      {setting?.support_number}
                    </Link>
                  </div>
                )}
                {isHydrated && setting?.support_email && (
                  <div className="flex gap-3 items-center min-w-0">
                    <span className="p-3 iconBackgroundColor rounded-lg shrink-0">
                      <BiMessageAltDots size={20} className="text-white" />
                    </span>
                    <Link
                      href={`mailto:${setting?.support_email}`}
                      className="min-w-0 break-all opacity-90 hover:opacity-100 transition-opacity duration-300"
                    >
                      {setting?.support_email}
                    </Link>
                  </div>
                )}
              </div>

              {/* Payment methods */}
              {isHydrated && enabledPaymentMethods?.length > 0 && (
                <div className="flex flex-col gap-3 mt-1 pt-5 border-t border-white/15">
                  <p className="font-semibold text-sm">{t("we_accept")}</p>
                  <div className="flex gap-3 flex-wrap items-center">
                    {enabledPaymentMethods.slice(0, 5)?.map((method, idx) => (
                      <div
                        key={idx}
                        className="w-10 h-7 bg-white rounded-sm flex justify-center items-center relative p-1"
                      >
                        <Image
                          src={method?.image}
                          alt={method?.label}
                          fill
                          className="object-contain p-1"
                          unoptimized={true}
                        />
                      </div>
                    ))}
                    {enabledPaymentMethods?.length > 5 && (
                      <div className="w-10 h-7 bg-white/20 rounded-sm flex justify-center items-center text-xs">
                        +{enabledPaymentMethods?.length - 5}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Copyright + social — one line */}
        <div className="w-full px-4 md:px-8 lg:px-16">
          {/* On mobile the floating support / back-to-top buttons sit fixed in the
            bottom-right corner, so the social row needs clearance to avoid being
            covered by them — hence the extra bottom margin below md. */}
          <div className="flex flex-col items-center gap-4 py-6 mb-[120px] md:mb-0 md:flex-row md:justify-between md:pr-16 lg:pr-20">
            <p className="text-sm opacity-90">
              {isHydrated ? setting?.web_settings?.copyright_details || "" : ""}
            </p>

            {/* Country selector — changing it opens the location modal */}
            {countries?.length > 0 && (
              <div className="relative md:ml-auto md:mr-4" ref={countryRef}>
                <button
                  type="button"
                  onClick={() => setCountryOpen((prev) => !prev)}
                  aria-haspopup="listbox"
                  aria-expanded={countryOpen}
                  aria-label={t("select_country") || "Select country"}
                  className="flex items-center gap-2 rounded-full border border-white/15 bg-white/5 py-1.5 pl-2 pr-3 text-sm transition-colors duration-300 hover:border-white/30"
                >
                  {selectedCountry?.logo_url ? (
                    <Image
                      src={selectedCountry.logo_url}
                      alt=""
                      width={20}
                      height={14}
                      className="h-[14px] w-[20px] shrink-0 rounded-[2px] object-cover"
                    />
                  ) : (
                    <IoLocationOutline
                      size={16}
                      className="shrink-0 opacity-70"
                    />
                  )}
                  <span className="opacity-90">
                    {selectedCountry?.name ||
                      t("select_country") ||
                      "Select country"}
                  </span>
                  <IoChevronForwardOutline
                    size={12}
                    className={`shrink-0 opacity-70 transition-transform duration-200 ${
                      countryOpen ? "-rotate-90" : "rotate-90"
                    }`}
                  />
                </button>

                {countryOpen && (
                  <ul
                    role="listbox"
                    aria-label={t("select_country") || "Select country"}
                    onKeyDown={handleCountryListKeyDown}
                    className="absolute bottom-full right-0 z-50 mb-2 max-h-[240px] w-[200px] overflow-y-auto rounded-xl border border-white/15 bg-[#1b2431] py-1 shadow-xl"
                  >
                    {countries.map((country: any, index: number) => (
                      <li key={country?.id}>
                        <button
                          type="button"
                          role="option"
                          ref={(el) => { countryOptionRefs.current[index] = el; }}
                          tabIndex={index === 0 ? 0 : -1}
                          aria-selected={selectedCountry?.id === country?.id}
                          onClick={() => handleCountryChange(country)}
                          className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors duration-200 hover:bg-white/10 ${
                            selectedCountry?.id === country?.id
                              ? "bg-white/10 font-medium"
                              : "opacity-90"
                          }`}
                        >
                          {country?.logo_url && (
                            <Image
                              src={country.logo_url}
                              alt=""
                              width={20}
                              height={14}
                              className="h-[14px] w-[20px] shrink-0 rounded-[2px] object-cover"
                            />
                          )}
                          <span className="truncate">{country?.name}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {isHydrated && setting?.social_media?.length > 0 && (
              <div className="flex gap-2.5">
                {setting?.social_media?.map((social: any) => {
                  // icon_url is only usable for uploaded-image entries; font entries render the glyph instead.
                  const iconSrc = socialIconUrl(social);
                  let icon = iconSrc ? (
                    <Image
                      src={iconSrc}
                      alt=""
                      width={18}
                      height={18}
                      className="h-[18px] w-[18px] object-contain"
                    />
                  ) : (
                    <i className={social?.icon}></i>
                  );
                  if (
                    !iconSrc &&
                    social?.icon?.toLowerCase().includes("wechat")
                  ) {
                    icon = <i className="fab fa-weixin"></i>;
                  } else if (
                    !iconSrc &&
                    social?.icon?.toLowerCase().includes("twitter")
                  ) {
                    icon = <FaXTwitter className={social?.icon} />;
                  }
                  return (
                    <Link
                      key={social?.id}
                      href={social?.link || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      // Icon-only link — no text node for a screen reader to read.
                      aria-label={social?.name || social?.icon || "Social link"}
                      className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-white/5 hover:primaryBackColor hover:border-transparent hover:scale-105 transition-all duration-300"
                    >
                      {icon}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>
    </>
  );
};

export default Footer;
