import { useEffect, useState, type MouseEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
} from "@/components/ui/dialog";
import Image from "next/image";
import Link from "next/link";
import { RiCloseFill } from "react-icons/ri";
import { useDispatch, useSelector } from "react-redux";
import { setIsPopupSeen } from "@/redux/slices/settingSlice";
import { useRouter } from "next/navigation";

import {
  setSelectedCategories,
  setListingSource,
  setCategorySlug,
  setCategoryBreadcrumb,
  setBlockSource,
} from "@/redux/slices/productFilterSlice";
import useZoneHref from "@/hooks/useZoneHref";
import { FILTER_PARAMS } from "@/utils/urlProductFilters";

const HomeOfferModal = () => {
  const zoneHref = useZoneHref();
  const dispatch = useDispatch();
  const setting = useSelector((state: any) => state.Setting);
  const city = useSelector((state: any) => state.City);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (setting?.setting?.popup_enabled === "1" && city?.city !== null) {
      // Show the modal only once
      const hasPopupBeenSeen = setting?.isPopupSeen;
      if (!hasPopupBeenSeen) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs modal visibility from redux settings/city once both load
        setIsModalOpen(true);
      }
    }
  }, [setting?.setting?.popup_enabled, city?.city, setting?.isPopupSeen]);

  const handleClose = () => {
    setIsModalOpen(false);
    dispatch(setIsPopupSeen({ data: true }));
  };

  const categoryBreadcrumb = useSelector(
    (state: any) => state.ProductFilter.categoryBreadcrumb,
  );

  const slug = setting?.setting?.popup_slug;
  // popup_type_id is the id of whatever popup_type points at — the category_id
  // for "category", the brand_id for "brand".
  const category_id = setting?.setting?.popup_type_id;
  const brand_id = setting?.setting?.popup_type_id;
  const type = setting?.setting?.popup_type;
  const url = setting?.setting?.popup_url;

  const getHref = () => {
    if (type === "product" && slug) return `/product/${slug}`;
    if (type === "popup_url" && url) return url;
    return "#";
  };

  const handlePopupClick = (e: MouseEvent<HTMLAnchorElement>) => {
    // 2. Handle the "Category" logic separately
    if (type === "category" && slug) {
      e.preventDefault(); // Stop the <Link> from navigating to "#"

      const exists = categoryBreadcrumb.find((c) => c.id === category_id);
      const newBreadcrumb = exists
        ? categoryBreadcrumb
        : [...categoryBreadcrumb, { id: category_id, name: slug, slug: slug }];

      dispatch(setListingSource({ data: "category" }));
      dispatch(setCategorySlug({ data: slug }));
      dispatch(setCategoryBreadcrumb({ data: newBreadcrumb }));
      dispatch(setSelectedCategories({ data: category_id }));
      // Clears any stale data_source/block_source_id from an earlier "See
      // All" block click — see ProductFilter.jsx's handleCategoryChange for
      // the same fix and why it's needed.
      dispatch(setBlockSource());

      handleClose();
      // next/navigation's router.push is string-only (no {pathname, query}
      // object form) — build the query string by hand. `slug` here is the
      // category's own slug (popup_slug, generic across popup types) — the
      // URL's category param is slug-typed, see categorySlugResolver.js.
      const qs = new URLSearchParams({
        [FILTER_PARAMS.category_id]: slug,
      }).toString();
      router.push(`${zoneHref("/products")}?${qs}`);
    } else if (type === "brand" && brand_id) {
      e.preventDefault(); // Stop the <Link> from navigating to "#"

      // "all", not "brand": listing_source only ever gates the CATEGORY-flow UI
      // (breadcrumb, hidden category filter — see ProductsList/FilterDrawer), so
      // a brand landing is a plain listing, same as ProductDetail's reset.
      dispatch(setListingSource({ data: "all" }));

      handleClose();
      // The URL's brand param is ID-typed and comma-separated (parseCsvInts on
      // query.brand, see urlProductFilters.ts) — NOT slug-typed like category,
      // so this sends popup_type_id rather than popup_slug.
      const qs = new URLSearchParams({
        [FILTER_PARAMS.brand_ids]: String(brand_id),
      }).toString();
      router.push(`${zoneHref("/products")}?${qs}`);
    } else {
      // For products and external URLs, just close the modal and let <Link> do its job
      handleClose();
    }
  };

  return (
    <div>
      <Dialog open={isModalOpen}>
        <DialogContent
          className="bg-transparent border-none shadow-none focus-visible:outline-none focus-within:border-none"
          onInteractOutside={(e) => e.preventDefault()}
          aria-describedby={undefined}
        >
          <DialogHeader>
            <DialogTitle>
              <div className="flex justify-end">
                <RiCloseFill
                  className="w-12 h-12 textColor closeButtonBg rounded-full p-[8px]  cursor-pointer"
                  onClick={handleClose}
                />
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="bg-transparent">
            <div className="h-full w-full">
              <Link
                href={getHref()}
                target={type === "popup_url" ? "_blank" : "_self"}
                onClick={handlePopupClick}
                className="block outline-none"
              >
                <Image
                  src={setting?.setting?.popup_image}
                  alt="Offer image"
                  height={1000}
                  width={1000}
                  className="h-full w-full object-contain focus-visible:outline-none"
                />
              </Link>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default HomeOfferModal;
