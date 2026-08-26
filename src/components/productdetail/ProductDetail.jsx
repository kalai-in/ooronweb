"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import * as api from "@/api/apiRoutes";
import { useDispatch, useSelector } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { FaStar, FaStarHalfAlt } from "react-icons/fa";
import { MdAddShoppingCart, MdRemoveShoppingCart } from "react-icons/md";
import { FiMinus, FiPlus } from "react-icons/fi";
import { t } from "@/utils/translation";
import {
  exceedsAllowedQty,
  hasReachedAllowedQty,
} from "@/utils/helperFunction";
import { useDebouncedQuantity } from "@/hooks/useDebouncedQuantity";
import ProductNotFoundImage from "@/assets/empty-state/no-product.svg";
import ThemedSvg from "@/components/notfound/ThemedSvg";
import { LuPill, LuTruck } from "react-icons/lu";
import CancelIcon from "@/assets/icon/cancel.svg";
import NotCancelIcon from "@/assets/icon/Not-cancel.svg";
import ReturnIcon from "@/assets/icon/return.svg";
import NoReturnIcon from "@/assets/icon/no-return.svg";
import CodIcon from "@/assets/icon/cod.svg";
import ProductDescription from "./ProductDescription";
import ProductRecommendations from "./ProductRecommendations";
import BreadCrumb from "../breadcrumb/BreadCrumb";
import Loader from "../loader/Loader";
import { toast } from "react-toastify";
import {
  addtoGuestCart,
  setCart,
  setCartProducts,
  setCartSubTotal,
  setGuestCartTotal,
} from "@/redux/slices/cartSlice";
import { useFavoriteToggle } from "@/hooks/useFavoriteToggle";
import SimilarProducts from "../productslist/SimilarProducts";
import { usePathname } from "next/navigation";
import Link from "next/link";
import ProductImageGallery from "./ProductImageGallery";
import ShareDrawer from "./ShareDrawer";
import useHydratedMediaQuery from "@/hooks/useHydratedMediaQuery";
import useDir from "@/hooks/useDir";
import MobileBottomSheet from "../mobile-bottom-sheet/MobileBottomSheet";
import {
  clearAllFilter,
  setListingSource,
} from "@/redux/slices/productFilterSlice";
import RecentalyViewedProducts from "../productslist/RecentalyViewedProducts";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { setIsRefetch } from "@/redux/slices/shopSlice";
import { getProductTypeMeta } from "./productType";
import useZoneHref from "@/hooks/useZoneHref";
import useStoreClosed from "@/hooks/useStoreClosed";
import useIsHydrated from "@/hooks/useIsHydrated";
import FewLeftBadge from "../productcards/FewLeftBadge";

// `initialProduct` is the server-fetched payload from getServerSideProps
// (SSR pilot). It seeds both the local `product` state and the react-query
// cache so the first server render emits real product HTML. It is null on
// client-side navigations, where the existing query path takes over unchanged.
const ProductDetail = ({ initialProduct = null }) => {
  const zoneHref = useZoneHref();
  const { guard: guardClosed, closedProps } = useStoreClosed();
  const isHydrated = useIsHydrated();
  // Hydration-safe: both start false on the server AND the first client render,
  // then settle. Plain useMediaQuery returns false on the server but true on a
  // desktop client, which mismatches and forces a full client re-render.
  const isMobileScreen = useHydratedMediaQuery("(max-width: 765px)");
  // Hover-zoom panel renders beside the image; only safe at lg+ where the image
  // sits in a column. Below that the image is full-width, so use a plain image.
  const canHoverZoom = useHydratedMediaQuery("(min-width: 1024px)");

  const dispatch = useDispatch();
  const router = useRouter();
  const { slug, isMobile } = router.query;
  const pathname = usePathname();
  const city = useSelector((state) => state.City.city);
  const cityStatus = useSelector((state) => state.City.status);
  const shopMode = useSelector((state) => state.ShopMode.mode);
  const setting = useSelector((state) => state.Setting);
  const language = useSelector((state) => state.Language.selectedLanguage);
  const dir = useDir();
  const cart = useSelector((state) => state.Cart);
  const user = useSelector((state) => state.User);
  const isMobileDevice = isMobile === "true";

  const [product, setProduct] = useState(initialProduct?.data ?? []);
  const [selectVariant, setSelectedVariant] = useState(
    initialProduct?.data?.variants?.[0] ?? [],
  );
  // Variant preselection from the active listing filter was dropped when
  // filters moved to the listing page's own URL (a different route/URL than
  // the PDP, so there's no filter state to read here anymore) — always the
  // first variant.
  const pickPreselectedVariant = (variants) => {
    const list = Array.isArray(variants) ? variants : [];
    return list.length ? list[0] : undefined;
  };

  const [ratingData, setRatingData] = useState({});
  const [quantity, setQuantity] = useState(1);
  const [productImages, setProductImages] = useState([]);
  const [selectedImage, setSelectedImage] = useState("");
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isVariantAvailable, setIsVariantAvailable] = useState(false);
  const [productNotAvailable, setProductNotAvailable] = useState(false);
  const [recentlyVisitedProduct, setRecentlyVisitedProduct] = useState([]);

  // Short-description clamp: show "View more" only when the text actually overflows 2 lines.
  const shortDescRef = useRef(null);
  // Scroll target: on the first add-to-cart we bring the recommendations
  // ("Frequently Bought Together") into view so the user sees related products.
  const recommendationsRef = useRef(null);
  const [isShortDescClamped, setIsShortDescClamped] = useState(false);

  const ratingsCount = 10;

  const handleAddRecentlyViewedProduct = async (product) => {
    try {
      if (user?.jwtToken) {
        await api.addRecentlyViewedProduct({
          productId: product?.id,
          latitude: city?.latitude,
          longitude: city?.longitude,
        });
      }
    } catch (error) {
      console.log("Error", error);
    }
  };

  const handleFetchRecentlyViewedProducts = async (product) => {
    try {
      if (user?.jwtToken) {
        const res = await api.getRecentlyViewedProducts({
          productId: product?.id,
          latitude: city?.latitude,
          longitude: city?.longitude,
        });
        if (res.status == 1) {
          // Exclude the current product, and backfill image_url (the card reads
          // product.image_url, but this payload only carries images[]/variants[].image).
          const list = Array.isArray(res?.data)
            ? res.data
                .filter((p) => p?.id !== product?.id)
                .map((p) => ({
                  ...p,
                  image_url:
                    p?.image_url ||
                    p?.images?.[0]?.image_url ||
                    p?.variants?.[0]?.image ||
                    "",
                }))
            : [];
          setRecentlyVisitedProduct(list);
        } else {
          setRecentlyVisitedProduct([]);
        }
      }
    } catch (error) {
      console.log("Error", error);
    }
  };

  const {
    isLoading: queryLoading,
    data: productResponse,
    isError,
  } = useQuery({
    // shopMode is in the key so toggling Quick/All Shop refetches with the new
    // `channel` header (injected by the axios interceptor from ShopMode.mode).
    queryKey: [
      "product",
      slug,
      city?.latitude,
      city?.longitude,
      language,
      shopMode,
    ],
    queryFn: async () => {
      try {
        const res = await api.getProductById({
          slug: slug,
          latitude: city.latitude,
          longitude: city.longitude,
          id: -1,
        });
        return res;
      } catch (err) {
        console.error("API Crash:", err);
        throw err;
      }
    },
    enabled: !!slug && !!city?.latitude,
    // Seed from the server fetch so the first render has data. Only applies
    // when this page was server-rendered; on client navigation initialProduct
    // is null and the query behaves exactly as before. initialDataUpdatedAt=0
    // marks the seed as immediately stale, so once the real city coords
    // rehydrate the query refetches for that location rather than leaving the
    // visitor on default_city data.
    initialData: initialProduct ?? undefined,
    initialDataUpdatedAt: initialProduct ? 0 : undefined,
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });

  useEffect(() => {
    if (productResponse) {
      const res = productResponse;
      if (res.status == 1) {
        // Clear the flag on every success, not just set it on failure: a product
        // can be absent from one channel and present in the other, so toggling
        // Quick -> All Shop -> Quick used to latch the not-found screen on and
        // never come back even though the refetch returned the product.
        // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs local product state from the react-query response
        setProductNotAvailable(false);
        setProduct(res?.data);
        setSelectedVariant(
          pickPreselectedVariant(res?.data?.variants) ??
            res?.data?.variants?.[0],
        );
        dispatch(setIsRefetch());
      } else {
        setProductNotAvailable(true);
      }
    }
  }, [productResponse, dispatch]);

  // Default-select the first variant once the product is available. Covers
  // the SSR path (initialProduct seeds `product` before the client fetch effect
  // runs). Guarded to the product id so it doesn't fight the user's manual
  // variant picks mid-session.
  const didPreselectRef = useRef(false);
  useEffect(() => {
    didPreselectRef.current = false;
  }, [product?.id]);
  useEffect(() => {
    if (!product?.id || didPreselectRef.current) return;
    const match = pickPreselectedVariant(product?.variants);
    if (match) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- default-selects the first variant once the product loads
      setSelectedVariant(match);
      didPreselectRef.current = true;
    }
  }, [product?.id, product?.variants]);

  // Recently-viewed is gated on auth. Run it whenever the product loads AND
  // whenever the user logs in/out — so logging in on the PDP (no refresh)
  // records the view and fetches the list immediately.
  useEffect(() => {
    if (!product?.id || !user?.jwtToken) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clears the recently-viewed list when signed out
      setRecentlyVisitedProduct([]);
      return;
    }
    handleAddRecentlyViewedProduct(product);
    handleFetchRecentlyViewedProducts(product);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id, user?.jwtToken, city?.latitude, city?.longitude]);

  // `images` entries come as { image_url } objects (older payloads sent plain strings).
  const toImageUrl = (img) => (typeof img === "string" ? img : img?.image_url);

  // Build the gallery from the selected variant's images, falling back to the
  // product-level image_url + images. Variant images carry the per-variant gallery.
  useEffect(() => {
    if (!product?.id) return;
    const variantImages = (selectVariant?.images || [])
      .map(toImageUrl)
      .filter(Boolean);
    const baseImages = [
      product?.image_url,
      ...(product?.images || []).map(toImageUrl),
    ].filter(Boolean);
    const gallery = variantImages.length ? variantImages : baseImages;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- rebuilds the image gallery from the selected variant/product
    setProductImages(gallery);
    setSelectedImage(gallery[0] || product?.image_url || "");
  }, [product, selectVariant]);

  // Detect whether the short description overflows its 2-line clamp; re-check on resize.
  useEffect(() => {
    const el = shortDescRef.current;
    if (!el) return;
    const check = () =>
      setIsShortDescClamped(el.scrollHeight > el.clientHeight + 1);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [product?.short_description]);

  // Variant label: prefer measurement+unit, else derive from attributes ("10 KG"), else name.
  const getVariantLabel = (variant) => {
    if (variant?.measurement) {
      const unit =
        variant?.unit?.translations?.short_code ??
        variant?.unit?.short_code ??
        "";
      return `${variant.measurement} ${unit}`.trim();
    }
    if (Array.isArray(variant?.attributes) && variant.attributes.length) {
      return variant.attributes
        .map((a) => `${a?.attribute_value} ${a?.attribute_name}`.trim())
        .join(", ");
    }
    return variant?.name ?? "";
  };

  // Title follows the selected variant; falls back to the parent product name.
  const displayName =
    selectVariant?.translations?.name ??
    selectVariant?.name ??
    product?.translations?.name ??
    product?.name;

  // True when an axis represents color — drives the swatch dot render.
  const isColorAxis = (axis) => /colou?r/i.test(axis?.attribute_name || "");

  // Per-axis variant selection (Color / Size separately). Reads current selection from
  // the selected variant's attributes; picking a value resolves to the matching variant.
  const selectedAxisValue = (attrId) =>
    selectVariant?.attributes?.find((a) => a.attribute_id === attrId)
      ?.attribute_value_id;

  // Resolve the variant that matches a proposed axis value combined with the
  // CURRENT selection of every other axis. Returns undefined when that exact
  // combination doesn't exist (e.g. Blue has no "M" size).
  const findVariantForAxis = (attrId, valueId) => {
    const desired = {};
    (selectVariant?.attributes || []).forEach(
      (a) => (desired[a.attribute_id] = a.attribute_value_id),
    );
    desired[attrId] = valueId;
    const ids = Object.keys(desired).map(Number);
    return product?.variants?.find((v) =>
      ids.every((id) =>
        v.attributes?.some(
          (a) => a.attribute_id === id && a.attribute_value_id === desired[id],
        ),
      ),
    );
  };

  // A value is selectable only if the exact combination with the other axes
  // exists AND is in stock. Unavailable combinations render disabled instead of
  // silently switching the user to a different variant.
  const isAxisValueAvailable = (attrId, valueId) => {
    const variant = findVariantForAxis(attrId, valueId);
    if (!variant) return false;
    if (variant?.status == 0) return false;
    if (product?.is_unlimited_stock == 0 && Number(variant?.stock) <= 0) {
      return false;
    }
    return true;
  };

  const handleSelectAxis = (attrId, valueId) => {
    // No silent fallback: if the exact combination doesn't exist the button is
    // disabled, so we never reach here for an unavailable value.
    const match = findVariantForAxis(attrId, valueId);
    if (match) handleChangeVariant(match);
  };

  const handleIsVariantAvailable = useCallback(() => {
    if (
      (product?.is_unlimited_stock == 0 && selectVariant?.stock <= 0) ||
      selectVariant?.status == 0
    ) {
      setIsVariantAvailable(false);
    } else {
      setIsVariantAvailable(true);
    }
  }, [product, selectVariant]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recomputes availability when the product/selected variant changes
    handleIsVariantAvailable();
  }, [handleIsVariantAvailable]);

  const { data: ratingResponse } = useQuery({
    queryKey: ["product-ratings", product?.id],
    queryFn: () =>
      api.getProductRatings({
        id: product?.id,
        limit: ratingsCount,
        offset: 0,
      }),
    enabled: !!product?.id,
    staleTime: 1000 * 60 * 10,
  });

  useEffect(() => {
    if (ratingResponse?.data) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs local rating state from the react-query response
      setRatingData(ratingResponse.data);
    }
  }, [ratingResponse]);
  const currency = product?.currency ?? setting?.setting?.currency;
  const decimalPoint =
    product?.decimal_point ?? setting?.setting?.decimal_point ?? 0;

  // Delivery pill shows only on the Quick channel (with a set location). Prefer the
  // product/variant ETA ("13 mins"); fall back to the global quick-delivery minutes.
  const quickDeliveryTime =
    setting?.setting?.web_settings?.delivery_time ||
    setting?.setting?.delivery_time ||
    10;
  const hasLocation = cityStatus === "fulfill";
  // Both `shopMode` and `cityStatus` are persisted, so the server renders them at
  // their defaults and the client renders the rehydrated values — the pill is
  // absent in the server HTML and present on the client, and React discards the
  // tree (#418). Gate on hydration so the first client render matches the server
  // and the pill appears on the second.
  const showQuickDelivery = isHydrated && shopMode === "quick" && hasLocation;
  const deliveryLabel =
    selectVariant?.time_to_deliver ||
    product?.time_to_deliver ||
    `${t("delivery_in")} ${quickDeliveryTime} ${t("minutes")}`;

  const handleChangeVariant = (variant) => {
    setQuantity(1);
    setSelectedVariant(variant);
  };
  const calculateDiscount = (discountPrice, actualPrice) => {
    const difference = actualPrice - discountPrice;
    const actualDiscountPrice = difference / actualPrice;
    return actualDiscountPrice * 100;
  };

  // Units of this variant already sitting in the cart. Drives the Blinkit-style
  // stepper below (Add to Cart → − qty + once in cart).
  const variantCartQty =
    (cart?.isGuest ? cart?.guestCart : cart?.cartProducts)?.find(
      (prdct) =>
        prdct?.product_id == product?.id &&
        prdct?.product_variant_id == selectVariant?.id,
    )?.qty || 0;

  // ── Blinkit-style cart stepper ──────────────────────────────────────────
  // Add to Cart morphs into a − qty + stepper once the variant is in the cart.
  // The stepper edits the CART directly (not the local selector). Server cart
  // uses the optimistic + debounced hook; guest cart mutates redux instantly.
  const serverAddToCart = async (qty, ctx) => {
    try {
      const response = await api.addToCart({
        product_id: product?.id,
        product_variant_id: selectVariant?.id,
        qty: Number(qty),
        latitude: city?.latitude,
        longitude: city?.longitude,
      });
      if (ctx?.isStale?.()) return;
      if (response.status == 1) {
        const serverCart = response?.data?.cart?.map((item) => ({
          product_id: item?.id,
          product_variant_id: item?.variant_id,
          qty: item?.variants?.[0]?.quantity ?? item?.quantity,
        }));
        dispatch(setCart({ data: response }));
        dispatch(setCartProducts({ data: serverCart ?? [] }));
        dispatch(setCartSubTotal({ data: response?.data?.sub_total }));
      } else {
        toast.error(response.message);
      }
    } catch (error) {
      console.log("error", error);
    }
  };

  const serverRemoveFromCart = async (units = 1, ctx) => {
    try {
      const response = await api.removeFromCart({
        product_id: product?.id,
        product_variant_id: selectVariant?.id,
        qty: units,
      });
      if (ctx?.isStale?.()) return;
      const alreadyGone =
        response?.status != 1 &&
        /not found|no item/i.test(response?.message || "");
      if (response?.status == 1 || alreadyGone) {
        const serverCart = response?.data?.cart?.map((item) => ({
          product_id: item?.id,
          product_variant_id: item?.variant_id,
          qty: item?.variants?.[0]?.quantity ?? item?.quantity,
        }));
        dispatch(setCartSubTotal({ data: response?.data?.sub_total ?? 0 }));
        dispatch(setCartProducts({ data: serverCart ?? [] }));
      } else {
        toast.error(response.message);
      }
    } catch (error) {
      console.log("error", error);
    }
  };

  // Cap = smaller of stock (when limited) and the per-product allowed quantity.
  const stepperAllowedCap = Number(product?.total_allowed_quantity) || Infinity;
  const stepperStockCap =
    selectVariant?.is_unlimited_stock == 0
      ? Number(selectVariant?.stock) || 0
      : Infinity;
  const stepperMaxQty = Math.min(stepperAllowedCap, stepperStockCap);

  const {
    displayQty: serverDisplayQty,
    increment: serverIncrement,
    decrement: serverDecrement,
  } = useDebouncedQuantity({
    serverQty: variantCartQty || 0,
    onCommit: (qty, ctx) => serverAddToCart(qty, ctx),
    onRemove: (units = 1, ctx) => serverRemoveFromCart(units, ctx),
    max: Number.isFinite(stepperMaxQty) ? stepperMaxQty : undefined,
    onMax: () =>
      toast.error(t("max_cart_limit_error"), {
        toastId: "max_cart_limit_error",
      }),
  });

  // Qty shown in the stepper. Guest = redux value; server = optimistic value.
  const stepperQty = cart?.isGuest ? variantCartQty : serverDisplayQty;
  // Show stepper once the variant is in the cart; otherwise the Add button.
  const showCartStepper = stepperQty > 0;
  const stepperAtMax = hasReachedAllowedQty(
    stepperQty,
    product?.total_allowed_quantity,
  );

  // Add the FIRST unit (qty 0 → 1). Reuses handleAddToCart for guest,
  // or debounced serverIncrement for logged in.
  // On this first add, gently scroll the recommendations into view so the
  // user discovers "Frequently Bought Together" / "Upgrade Your Order".
  const handleStepperAdd = () => {
    setQuantity(1);
    if (cart?.isGuest) {
      handleAddToCart();
    } else {
      serverIncrement();
    }
    setTimeout(() => {
      recommendationsRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 350);
  };

  const handleGuestStepperIncrease = () => {
    if (
      selectVariant?.is_unlimited_stock == 0 &&
      variantCartQty >= Number(selectVariant?.stock)
    ) {
      toast.error(t("out_of_stock_message"), {
        toastId: "out_of_stock_message",
      });
      return;
    }
    if (hasReachedAllowedQty(variantCartQty, product?.total_allowed_quantity)) {
      toast.error(t("max_cart_limit_error"), {
        toastId: "max_cart_limit_error",
      });
      return;
    }
    const updatedProducts = cart?.guestCart?.map((cartProduct) =>
      cartProduct?.product_id == product?.id &&
      cartProduct?.product_variant_id == selectVariant?.id
        ? { ...cartProduct, qty: Number(cartProduct?.qty) + 1 }
        : cartProduct,
    );
    dispatch(addtoGuestCart({ data: updatedProducts }));
    handleCalculateTotal(updatedProducts);
  };

  const handleGuestStepperDecrease = () => {
    if (variantCartQty <= 1) {
      const remaining = cart?.guestCart?.filter(
        (cartProduct) =>
          !(
            cartProduct?.product_id == product?.id &&
            cartProduct?.product_variant_id == selectVariant?.id
          ),
      );
      dispatch(addtoGuestCart({ data: remaining }));
      handleCalculateTotal(remaining);
      return;
    }
    const updatedProducts = cart?.guestCart?.map((cartProduct) =>
      cartProduct?.product_id == product?.id &&
      cartProduct?.product_variant_id == selectVariant?.id
        ? { ...cartProduct, qty: Number(cartProduct?.qty) - 1 }
        : cartProduct,
    );
    dispatch(addtoGuestCart({ data: updatedProducts }));
    handleCalculateTotal(updatedProducts);
  };

  const handleStepperIncrease = () => {
    if (cart?.isGuest) {
      handleGuestStepperIncrease();
    } else {
      serverIncrement();
    }
  };

  const handleStepperDecrease = () => {
    if (cart?.isGuest) {
      handleGuestStepperDecrease();
    } else {
      serverDecrement();
    }
  };

  const handleCalculateTotal = (products) => {
    const total = products.reduce((prev, curr) => {
      prev += curr.productPrice * curr.qty;
      return prev;
    }, 0);
    dispatch(setGuestCartTotal({ data: total }));
  };

  const getProductQuantities = (products) => {
    return Object.entries(
      products?.reduce((quantities, product) => {
        const existingQty = quantities[product.product_id] || 0;
        return {
          ...quantities,
          [product.product_id]: existingQty + product.qty,
        };
      }, {}),
    ).map(([productId, qty]) => ({
      product_id: Number.parseInt(productId),
      qty,
    }));
  };

  const handleAddToCart = async () => {
    let productQuantity = cart?.isGuest
      ? getProductQuantities(cart?.guestCart)
      : getProductQuantities(cart?.cartProducts);
    const isExisting = cart.guestCart.some(
      (cartProduct) =>
        cartProduct?.product_id == product?.id &&
        cartProduct?.product_variant_id == selectVariant?.id,
    );
    const productQty = productQuantity?.find(
      (prdct) => prdct?.product_id == product?.id,
    )?.qty;
    const cartProductQty = cart.cartProducts.find(
      (prdct) =>
        prdct?.product_id == product?.id &&
        selectVariant?.id == prdct?.product_variant_id,
    );
    const totalQty = productQty ? productQty + quantity : quantity;
    if (Number(product?.is_unlimited_stock) == 0 && selectVariant?.stock <= 0) {
      toast.error(t("out_of_stock_message"), {
        toastId: "out_of_stock_message",
      });
      return;
    }
    if (cart?.isGuest) {
      if (exceedsAllowedQty(totalQty, product?.total_allowed_quantity)) {
        toast.error(t("max_cart_limit_error"), {
          toastId: "max_cart_limit_error",
        });
      } else {
        if (isExisting) {
          const updatedProduct = cart.guestCart?.map((cartProduct) => {
            if (
              cartProduct?.product_id == product?.id &&
              cartProduct?.product_variant_id == selectVariant?.id
            ) {
              return { ...cartProduct, qty: cartProduct.qty + quantity };
            } else {
              return cartProduct;
            }
          });
          dispatch(addtoGuestCart({ data: updatedProduct }));
          handleCalculateTotal(updatedProduct);
          setQuantity(1);
          toast.success(t("product_added_successfully"));
        } else {
          const productPrice =
            selectVariant.discounted_price !== 0
              ? selectVariant.discounted_price
              : selectVariant.price;
          const productData = {
            product_id: product?.id,
            product_variant_id: selectVariant?.id,
            qty: quantity,
            productPrice: productPrice,
          };
          dispatch(addtoGuestCart({ data: [...cart?.guestCart, productData] }));
          let products = [...cart.guestCart, productData];
          handleCalculateTotal(products);
          setQuantity(1);
          toast.success(t("product_added_successfully"));
        }
      }
    } else {
      const isInclude = productQuantity.some(
        (item) => item.product_id === product?.id,
      );

      try {
        if (exceedsAllowedQty(totalQty, product?.total_allowed_quantity)) {
          toast.error(t("max_cart_limit_error"), {
            toastId: "max_cart_limit_error",
          });
        } else if (
          !isInclude &&
          cart?.cartProducts?.length >= setting?.setting?.max_cart_items_count
        ) {
          toast.error(t("maximum_cart_quantity_reach"));
        } else {
          const response = await api.addToCart({
            product_id: product?.id,
            product_variant_id: selectVariant.id,
            qty: cartProductQty ? cartProductQty.qty + quantity : quantity,
            latitude: city?.latitude,
            longitude: city?.longitude,
          });
          if (response.status == 1) {
            if (cartProductQty) {
              const updatedProducts = cart.cartProducts.map((cartProduct) => {
                if (
                  cartProduct.product_id == product?.id &&
                  cartProduct.product_variant_id == selectVariant.id
                ) {
                  return {
                    ...cartProduct,
                    qty: cartProductQty
                      ? cartProductQty.qty + quantity
                      : quantity,
                  };
                } else {
                  return cartProduct;
                }
              });
              dispatch(setCartProducts({ data: updatedProducts }));
            } else {
              const productData = [
                ...cart.cartProducts,
                {
                  product_id: product?.id,
                  product_variant_id: selectVariant?.id,
                  qty: quantity,
                },
              ];
              dispatch(setCartProducts({ data: productData }));
            }
            dispatch(setCart({ data: response }));
            dispatch(setCartSubTotal({ data: response.sub_total }));
            toast.success(t("product_added_successfully"));
          } else if (response?.message == "opps_stock_is_not_available") {
            toast.error(t("out_of_stock_message"));
          } else {
            toast.error(response?.message);
          }
        }
      } catch (error) {
        console.log("Error", error);
      }
    }
  };

  // Optimistic + in-flight-guarded wishlist toggle. Rapid clicks used to each
  // read the pre-response redux state and fire their own addToFavorite; the hook
  // flips redux on click and drops clicks while a call is running.
  const { liked: isFavorite, toggle: handleProductLikes } = useFavoriteToggle({
    productId: product?.id,
  });

  const handleChangeCoverImage = (image) => {
    setSelectedImage(image);
  };

  // Buy Now = add to cart, then jump to the cart page.
  const handleBuyNow = async () => {
    await handleAddToCart();
    router.push(zoneHref("/cart"));
  };

  // Discount badge (e.g. "10% OFF") + strike-through pricing.
  const hasDiscount =
    selectVariant?.discounted_price !== 0 &&
    selectVariant?.discounted_price !== selectVariant?.price;
  const discountLabel = hasDiscount
    ? `${calculateDiscount(
        selectVariant?.discounted_price,
        selectVariant?.price,
      ).toFixed(decimalPoint)}% ${t("off")}`
    : null;

  // Brand id may arrive on the product directly or nested under a brand object.
  const brandId = product?.brand_id ?? product?.brand?.id;
  const handleBrandNavigation = () => {
    if (!brandId) return;
    dispatch(clearAllFilter());
    dispatch(setListingSource({ data: "all" }));
    router.push({
      pathname: zoneHref("/products"),
      query: { brand: parseInt(brandId) },
    });
  };

  if (queryLoading) {
    return (
      <section>
        <div className="h-[100vh]">
          <Loader screen="full" />
        </div>
      </section>
    );
  }

  if (isError || productNotAvailable == true) {
    return (
      <section>
        <div className="h-full w-full flex flex-col items-center my-4">
          <ThemedSvg
            src={ProductNotFoundImage}
            alt={"not product found"}
            className="w-full max-w-[400px]"
          />
          <p className="text-3xl font-bold w-1/3 text-center">
            {t("oops")} {t("product_is_either_unavailable_or_does_not_exist")}
          </p>
          <Link
            href={"/"}
            className="px-4 py-2 rounded-md font-medium primaryBackColor text-white"
          >
            {t("go_back")}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section>
      <BreadCrumb
        title={product?.translations?.name ?? product?.name}
        categoryId={product?.category_id ?? product?.category?.id}
        categorySlug={product?.category_slug ?? product?.category?.slug}
      />
      <div className="container mb-6">
        <div className="mt-1">
          <div className="flex flex-col justify-center">
            <div className="grid grid-cols-1 lg:grid-cols-12 mt-2 gap-4 items-start">
              <div className="relative z-20 col-span-12 lg:col-span-6 flex flex-col gap-4 lg:sticky lg:top-[120px] lg:self-start">
                <ProductImageGallery
                  product={product}
                  productImages={productImages}
                  selectedImage={selectedImage}
                  onSelectImage={handleChangeCoverImage}
                  canHoverZoom={canHoverZoom}
                  language={language}
                  isFavorite={isFavorite}
                  onToggleFavorite={handleProductLikes}
                  onShare={() => setIsShareOpen(true)}
                />
              </div>
              <div className="col-span-12 lg:col-span-6">
                <div className="relative flex flex-col gap-3">
                  {/* Badges */}
                  {/* <div className="flex items-center gap-3">
                     
                        {product?.is_new_arrival ? (
                          <span className="text-xs font-bold uppercase tracking-wide primaryColor">
                            {t("new_arrival")}
                          </span>
                        ) : null}
                      </div> */}

                  {/* Title */}
                  <h1 className="pe-12 text-2xl sm:text-3xl font-bold leading-tight">
                    {displayName}
                  </h1>

                  {/* Brand — inline, name highlighted. */}
                  {product?.brand_name && (
                    <div className="flex items-center gap-1.5 text-sm">
                      <span className="text-gray-500 dark:text-zinc-400">
                        {t("brand")}
                      </span>
                      {brandId ? (
                        <button
                          type="button"
                          onClick={handleBrandNavigation}
                          className="font-semibold primaryColor hover:underline"
                        >
                          {product?.brand_name}
                        </button>
                      ) : (
                        <span className="font-semibold primaryColor">
                          {product?.brand_name}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Rating — only when ratings are enabled AND there's at least one. */}
                  {product?.product_rating == true &&
                    (ratingData?.average_rating > 0 ||
                      product?.rating_count > 0) && (
                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => {
                            const roundedRating =
                              Math.round(
                                (ratingData?.average_rating || 0) * 2,
                              ) / 2;
                            if (star <= Math.floor(roundedRating)) {
                              return (
                                <FaStar
                                  key={star}
                                  size={16}
                                  className="fill-yellow-400 text-yellow-400"
                                />
                              );
                            } else if (
                              star === Math.floor(roundedRating) + 1 &&
                              roundedRating % 1 === 0.5
                            ) {
                              return (
                                <FaStarHalfAlt
                                  key={star}
                                  size={16}
                                  className="fill-yellow-400 text-yellow-400"
                                />
                              );
                            }
                            return (
                              <FaStar
                                key={star}
                                size={16}
                                className="fill-gray-200 text-gray-200"
                              />
                            );
                          })}
                        </div>
                        <span className="font-bold text-gray-900 dark:text-zinc-100">
                          {(ratingData?.average_rating || 0).toFixed(0)}
                          <span className="font-normal text-gray-400 dark:text-zinc-500">
                            /5.0
                          </span>
                        </span>
                        <span className="text-gray-500 dark:text-zinc-400">
                          ({product?.rating_count || 0} {t("reviews")})
                        </span>
                      </div>
                    )}

                  {/* Price (left) + delivery pill (right) */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 sm:gap-3">
                      <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-gray-900 dark:text-zinc-100">
                        {currency}
                        {hasDiscount
                          ? selectVariant?.discounted_price
                          : selectVariant?.price}
                      </span>
                      {hasDiscount && (
                        <span className="text-sm sm:text-lg font-medium text-gray-400 dark:text-zinc-500 line-through">
                          {currency}
                          {selectVariant?.price}
                        </span>
                      )}
                      {discountLabel && (
                        <span className="whitespace-nowrap self-center rounded-md bg-green-100 px-2 py-1 text-xs font-bold uppercase text-green-700">
                          {discountLabel}
                        </span>
                      )}
                    </div>

                    {/* Estimated delivery — Quick channel only; hidden on All Shop. */}
                    {showQuickDelivery && (
                      <div className="inline-flex w-fit items-center gap-2 rounded-full primaryLightBack py-1.5 ps-2 pe-3.5 text-sm">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white dark:bg-zinc-900 shadow-sm">
                          <LuTruck
                            size={16}
                            className={`primaryColor ${dir === "RTL" ? "-scale-x-100" : ""}`}
                          />
                        </span>
                        <span dir="auto" className="font-bold primaryColor">
                          {deliveryLabel}
                        </span>
                      </div>
                    )}
                  </div>

                  <FewLeftBadge
                    variant={selectVariant}
                    product={product}
                    size={14}
                    className="!text-sm !font-bold"
                  />

                  {/* Short description */}
                  {product?.short_description && (
                    <div className="flex flex-col items-start gap-1">
                      <p
                        ref={shortDescRef}
                        className="line-clamp-3 text-base font-normal leading-6 text-gray-600 dark:text-zinc-300"
                      >
                        {product?.short_description}
                      </p>
                      {isShortDescClamped && (
                        <TooltipProvider delayDuration={150}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="primaryColor text-sm font-medium underline underline-offset-2"
                              >
                                {t("view_more")}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="max-w-sm text-gray-600 dark:text-zinc-300">
                              {product?.short_description}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  )}

                  {/* Variant selector — one row per axis (Color, Size, …) */}
                  {product?.variants?.length > 1 &&
                    (Array.isArray(product?.variant_axes) &&
                    product.variant_axes.length ? (
                      <div className="flex flex-wrap gap-x-6 gap-y-3">
                        {product.variant_axes.map((axis) => {
                          const sel = selectedAxisValue(axis.attribute_id);
                          return (
                            <div
                              key={axis.attribute_id}
                              className="flex min-w-[120px] flex-col gap-1.5"
                            >
                              <p className="text-sm font-semibold text-gray-700 dark:text-zinc-200">
                                {axis.attribute_name}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {axis.values?.map((val) => {
                                  const isSel = sel === val.attribute_value_id;
                                  // The current selection stays enabled; every
                                  // other value is only enabled if its combo
                                  // with the other axes exists and is in stock.
                                  const available =
                                    isSel ||
                                    isAxisValueAvailable(
                                      axis.attribute_id,
                                      val.attribute_value_id,
                                    );
                                  // Color swatch only when the value carries a usable color (hex/name).
                                  const swatch =
                                    val.swatch_value ||
                                    val.color ||
                                    (isColorAxis(axis)
                                      ? val.attribute_value
                                      : null);
                                  return (
                                    <button
                                      key={val.attribute_value_id}
                                      type="button"
                                      disabled={!available}
                                      aria-disabled={!available}
                                      title={
                                        available
                                          ? undefined
                                          : t("not_available")
                                      }
                                      onClick={() =>
                                        handleSelectAxis(
                                          axis.attribute_id,
                                          val.attribute_value_id,
                                        )
                                      }
                                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition ${
                                        isSel
                                          ? "primaryBorder primaryLightBack primaryColor dark:bg-white/10 dark:text-white dark:border-white"
                                          : !available
                                            ? "border-gray-200 dark:border-zinc-700 text-gray-400 dark:text-zinc-600 line-through opacity-60 cursor-not-allowed"
                                            : "border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-200 hover:border-gray-400"
                                      }`}
                                    >
                                      {/* {isColorAxis(axis) && swatch && (
                                            <span
                                              className="h-3.5 w-3.5 shrink-0 rounded-full border border-black/10"
                                              style={{
                                                backgroundColor: swatch,
                                              }}
                                            />
                                          )} */}
                                      {val.attribute_value}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        <p className="text-base font-medium">
                          {t("chooseVariant")} :{" "}
                          <span className="font-semibold">
                            {getVariantLabel(selectVariant)}
                          </span>
                        </p>
                        <div className="flex flex-wrap gap-3">
                          {product?.variants?.map((variant) => (
                            <button
                              key={variant.id}
                              type="button"
                              onClick={() => handleChangeVariant(variant)}
                              className={`rounded-full border px-5 py-2 text-sm font-medium transition ${
                                selectVariant?.id == variant?.id
                                  ? "primaryBorder primaryBackColor text-white"
                                  : "border-[#DFE3E8] dark:border-zinc-700 text-gray-700 dark:text-zinc-200 hover:primaryBorder"
                              }`}
                            >
                              {getVariantLabel(variant)}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}

                  <hr className="border-gray-200 dark:border-zinc-700 my-0.5" />

                  {/* Actions — Blinkit-style: Add to Cart morphs into a
                          − qty + stepper once the variant is in the cart. */}
                  <div className="flex flex-col gap-2">
                    {isVariantAvailable ? (
                      <div className="flex w-full max-w-[360px] items-center gap-2">
                        {showCartStepper ? (
                          <div
                            {...closedProps}
                            className={`flex h-10 flex-1 items-center justify-between rounded-lg border primaryBorder bg-transparent px-1 primaryColor dark:text-white dark:border-white/40 ${closedProps.className ?? ""}`}
                          >
                            <button
                              type="button"
                              className="flex h-8 w-9 items-center justify-center rounded-md text-lg transition hover:primaryLightBack dark:hover:bg-white/10"
                              onClick={guardClosed(handleStepperDecrease)}
                            >
                              <FiMinus />
                            </button>
                            <span className="min-w-[24px] text-center text-sm font-bold">
                              {stepperQty}
                            </span>
                            <button
                              type="button"
                              disabled={stepperAtMax}
                              aria-disabled={stepperAtMax}
                              className="flex h-8 w-9 items-center justify-center rounded-md text-lg transition hover:primaryLightBack dark:hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed"
                              onClick={guardClosed(handleStepperIncrease)}
                            >
                              <FiPlus />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            // eslint-disable-next-line react-hooks/refs -- handleStepperAdd only reads recommendationsRef.current inside a later setTimeout callback, not during render
                            onClick={guardClosed(handleStepperAdd)}
                            {...closedProps}
                            className={`flex h-10 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg border primaryBorder primaryColor dark:text-white dark:border-white/40 text-[13px] font-semibold transition hover:primaryBackColor hover:text-white hover:border-transparent ${closedProps.className ?? ""}`}
                          >
                            <MdAddShoppingCart size={16} />
                            {t("add_to_cart")}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={guardClosed(handleBuyNow)}
                          {...closedProps}
                          className={`flex h-10 flex-1 items-center justify-center whitespace-nowrap rounded-lg primaryBackColor text-[13px] font-semibold text-white transition hover:opacity-90 ${closedProps.className ?? ""}`}
                        >
                          {t("buy_now")}
                        </button>
                      </div>
                    ) : (
                      <div className="inline-flex h-10 w-fit items-center gap-2 rounded-lg border border-[#db3d26]/30 bg-[#db3d26]/10 px-4 text-sm font-semibold text-[#db3d26]">
                        <MdRemoveShoppingCart size={16} />
                        {t("out_of_stock")}
                      </div>
                    )}
                  </div>

                  {/* Trust badges — all in one line: centered icon + label, divided. */}
                  <div
                    className={`flex items-stretch divide-x divide-gray-200 dark:divide-zinc-700 rounded-xl border border-gray-200 dark:border-zinc-700 py-3 ${dir === "RTL" ? "divide-x-reverse" : ""}`}
                  >
                    {(() => {
                      const typeMeta = getProductTypeMeta(
                        product?.product_type ?? product?.indicator,
                      );
                      if (!typeMeta) return null;
                      const { svg, Icon, labelKey, color } = typeMeta;
                      return (
                        <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-2 text-center">
                          {svg ? (
                            <span className="relative h-8 w-8">
                              <Image
                                src={svg}
                                fill
                                alt={t(labelKey)}
                                className="object-contain"
                              />
                            </span>
                          ) : (
                            <Icon className={`h-7 w-7 ${color}`} />
                          )}
                          <span className="text-[11px] font-semibold leading-tight text-gray-700 dark:text-zinc-200">
                            {t(labelKey)}
                          </span>
                        </div>
                      );
                    })()}

                    <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-2 text-center">
                      <ThemedSvg
                        src={
                          product?.cancelable_status == 1
                            ? CancelIcon
                            : NotCancelIcon
                        }
                        alt="cancelable"
                        className="h-8 w-8"
                      />
                      <span className="text-[11px] font-semibold leading-tight text-gray-700 dark:text-zinc-200">
                        {product?.cancelable_status == 1
                          ? (() => {
                              const STATUS_LABELS = {
                                1: "paymentPending",
                                2: "order_status_display_name_recieved",
                                3: "processed",
                                4: "order_status_display_name_shipped",
                                5: "out_for_delivery",
                                6: "order_status_display_name_delivered",
                                7: "cancelled",
                                8: "returned",
                                9: "order_in_process",
                                10: "ready_to_pickup",
                              };
                              const tillValue = Number(
                                shopMode === "quick"
                                  ? product?.till_status_quick
                                  : product?.till_status_ecommerce,
                              );
                              const statusLabel = STATUS_LABELS[tillValue];
                              return tillValue > 0 && statusLabel
                                ? `${t("cancel_before")} ${t(statusLabel)}`
                                : t("cancelable");
                            })()
                          : t("non-cancelable")}
                      </span>
                    </div>

                    <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-2 text-center">
                      <ThemedSvg
                        src={
                          product?.return_status == 1
                            ? ReturnIcon
                            : NoReturnIcon
                        }
                        alt="returnable"
                        className="h-8 w-8"
                      />
                      <span className="text-[11px] font-semibold leading-tight text-gray-700 dark:text-zinc-200">
                        {product?.return_status == 1
                          ? Number(product?.return_days) === 0
                            ? t("easy_return")
                            : `${t("returnable")} ${product?.return_days} ${Number(product?.return_days) === 1 ? t("day") : t("days")}`
                          : t("non-returnable")}
                      </span>
                    </div>

                    {product?.cod_allowed == 1 && (
                      <div className="flex flex-1 flex-col items-center justify-center gap-1.5 px-2 text-center">
                        <ThemedSvg
                          src={CodIcon}
                          alt="cash on delivery"
                          className="h-8 w-8"
                        />
                        <span className="text-[11px] font-semibold leading-tight text-gray-700 dark:text-zinc-200">
                          {t("cash_on_delivery")}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Prescription note — medical products only (product_type 5). */}
                  {Number(product?.product_type) === 5 &&
                    product?.prescription_note && (
                      <div className="flex items-start gap-3 rounded-r-lg primaryColorBorder border-0 border-l-4 primaryLightBack px-4 py-3">
                        <LuPill
                          size={18}
                          className="mt-0.5 shrink-0 primaryColor"
                        />
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-bold uppercase tracking-wide primaryColor">
                            {t("prescription_required") ||
                              "Prescription Required"}
                          </span>
                          <span className="text-sm leading-relaxed text-gray-700 dark:text-zinc-200 whitespace-pre-line">
                            {product?.prescription_note?.replace(/\*\*/g, "")}
                          </span>
                        </div>
                      </div>
                    )}

                  {/* Meta */}
                  <div
                    dir={dir === "RTL" ? "rtl" : "ltr"}
                    className="flex flex-col gap-3 text-sm"
                  >
                    {product?.category_name && (
                      <div className="flex gap-2">
                        <span className="font-semibold whitespace-nowrap text-start">
                          {t("category")} :
                        </span>
                        <span className="text-gray-600 dark:text-zinc-300">
                          {product?.category_name}
                        </span>
                      </div>
                    )}
                    {product?.tag_names && (
                      <div className="flex gap-2">
                        <span className="font-semibold whitespace-nowrap text-start">
                          {t("tag")} :
                        </span>
                        <span className="text-gray-600 dark:text-zinc-300">
                          {Array.isArray(product?.tag_names)
                            ? product.tag_names.join(", ")
                            : product?.tag_names}
                        </span>
                      </div>
                    )}
                    {product?.made_in?.name && (
                      <div className="flex gap-2">
                        <span className="font-semibold whitespace-nowrap text-start">
                          {t("made_in")} :
                        </span>
                        <span className="text-gray-600 dark:text-zinc-300">
                          {product?.made_in?.name}
                        </span>
                      </div>
                    )}
                    {product?.store_name && (
                      <div className="flex gap-2">
                        <span className="font-semibold whitespace-nowrap text-start">
                          {t("sold_by")} :
                        </span>
                        <span className="text-gray-600 dark:text-zinc-300">
                          {product?.store_name}
                        </span>
                      </div>
                    )}
                    {product?.manufacturer && (
                      <div className="flex gap-2">
                        <span className="font-semibold whitespace-nowrap text-start">
                          {t("manufacturer")} :
                        </span>
                        <span className="text-gray-600 dark:text-zinc-300">
                          {product?.manufacturer}
                        </span>
                      </div>
                    )}

                    {product?.fssai_lic_no && (
                      <div className="flex items-center gap-2">
                        <span className="font-semibold whitespace-nowrap text-start">
                          {t("fssai_license_no")}
                        </span>
                        {product?.fssai_lic_img && (
                          <Image
                            width={100}
                            height={100}
                            src={product?.fssai_lic_img}
                            className="w-9 h-9 object-contain"
                            alt="fssaiImage"
                          />
                        )}
                        <span className="text-gray-600 dark:text-zinc-300">
                          {product?.fssai_lic_no}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Share — pinned to bottom */}
                  {/* <div className="mt-auto flex items-center gap-4 border-t border-gray-200 pt-4">
                        <span className="text-sm font-medium">
                          {t("shareProduct")}:
                        </span>
                        <div className="flex gap-3">
                          <WhatsappShareButton
                            url={`${process.env.NEXT_PUBLIC_BASE_URL}${decodeURI(
                              pathname,
                            )}`}
                          >
                            <WhatsappIcon className="h-8 w-8 rounded-full" />
                          </WhatsappShareButton>
                          <TwitterShareButton
                            url={`${process.env.NEXT_PUBLIC_BASE_URL}${decodeURI(
                              pathname,
                            )}`}
                          >
                            <TwitterIcon className="h-8 w-8 rounded-full" />
                          </TwitterShareButton>
                          <FacebookShareButton
                            url={`${process.env.NEXT_PUBLIC_BASE_URL}${decodeURI(
                              pathname,
                            )}`}
                          >
                            <FacebookIcon className="h-8 w-8 rounded-full" />
                          </FacebookShareButton>
                          <FaLink
                            className="h-8 w-8 rounded-full bg-gray-400 p-2 hover:cursor-pointer"
                            onClick={handleCopyToClipboard}
                          />
                        </div>
                      </div> */}
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Specifications — fully dynamic from the variant's custom_sections.
                Admin-added sections/fields auto-render; nothing is hardcoded. */}
        {Array.isArray(selectVariant?.custom_sections) &&
          selectVariant.custom_sections.length > 0 && (
            <div className="rounded-sm my-2 cardBorder p-4 flex flex-col gap-5">
              <h2 className="text-lg md:text-xl font-bold textColor">
                {t("specifications")}
              </h2>
              {selectVariant.custom_sections.map((section) => (
                <div key={section?.section_id} className="flex flex-col gap-2">
                  {section?.section_name && (
                    <h3 className="text-base font-semibold primaryColor dark:text-zinc-200">
                      {section?.section_name}
                    </h3>
                  )}
                  <div className="overflow-hidden rounded-md cardBorder">
                    {section?.fields?.map((field, index) => (
                      <div
                        key={`${section?.section_id}-${index}`}
                        className={`flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-4 px-4 py-2.5 ${
                          index % 2 === 0 ? "backgroundColor" : ""
                        }`}
                      >
                        <span className="w-full sm:w-56 shrink-0 text-sm font-medium text-gray-600 dark:text-zinc-300">
                          {field?.field_label}
                        </span>
                        <span className="flex-1 min-w-0 text-sm font-semibold break-words textColor">
                          {field?.value ?? "-"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

        <ProductDescription
          product={product}
          selectVariant={selectVariant}
          ratingData={ratingData}
        />
        {product?.id && (
          <div ref={recommendationsRef} className="scroll-mt-28">
            <ProductRecommendations productId={product?.id} />
          </div>
        )}
        {product?.id && <SimilarProducts productId={product?.id} />}
        <RecentalyViewedProducts
          recentalyViewedProducts={recentlyVisitedProduct}
        />
      </div>
      {isMobileScreen && isMobileDevice && <MobileBottomSheet isOpen={true} />}
      <ShareDrawer
        open={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        url={`${process.env.NEXT_PUBLIC_BASE_URL}${decodeURI(pathname)}`}
        title={displayName}
        description={product?.short_description}
        image={selectedImage || product?.image_url}
      />
    </section>
  );
};

export default ProductDetail;
