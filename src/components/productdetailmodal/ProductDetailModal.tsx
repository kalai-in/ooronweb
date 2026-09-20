"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as api from "@/api/apiRoutes";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FaStar, FaStarHalfAlt } from "react-icons/fa";
import Image from "next/image";
import { Swiper, SwiperSlide } from "swiper/react";
import "swiper/css";
import "swiper/css/navigation";
import { Navigation } from "swiper/modules";
import { useSelector, useDispatch } from "react-redux";
import { t } from "@/utils/translation";
import { FiMinus, FiPlus } from "react-icons/fi";
import {
  LuPill,
  LuTruck,
} from "react-icons/lu";
import CancelIcon from "@/assets/icon/cancel.svg";
import NotCancelIcon from "@/assets/icon/Not-cancel.svg";
import ReturnIcon from "@/assets/icon/return.svg";
import NoReturnIcon from "@/assets/icon/no-return.svg";
import CodIcon from "@/assets/icon/cod.svg";
import ThemedSvg from "@/components/notfound/ThemedSvg";

import { RiCloseFill } from "react-icons/ri";
import {
  addtoGuestCart,
  setCart,
  setCartProducts,
  setCartSubTotal,
  setGuestCartTotal,
} from "@/redux/slices/cartSlice";
import { toast } from "react-toastify";
import { BiHeart, BiSolidHeart } from "react-icons/bi";
import { useFavoriteToggle } from "@/hooks/useFavoriteToggle";
import Loader from "../loader/Loader";
import ImageWithPlaceholder from "../image-with-placeholder/ImageWithPlaceholder";
import useIsRtl from "@/hooks/useIsRtl";
import { MdAddShoppingCart, MdRemoveShoppingCart } from "react-icons/md";
import {
  hasReachedAllowedQty,
  exceedsAllowedQty,
  getCartTotalQuantity,
  getMaxAddableQuantity,
} from "@/utils/helperFunction";
import { getProductTypeMeta } from "../productdetail/productType";
import { useDebouncedQuantity } from "@/hooks/useDebouncedQuantity";
import useZoneHref from "@/hooks/useZoneHref";
import useStoreClosed from "@/hooks/useStoreClosed";
import FewLeftBadge from "../productcards/FewLeftBadge";
import useCurrency from "@/hooks/useCurrency";

interface ProductDetailModalProps {
  product: any;
  showDetailModal: boolean;
  setShowDetailModal: (show: boolean) => void;
}

const ProductDetailModal = ({
  product,
  showDetailModal,
  setShowDetailModal,
}: ProductDetailModalProps) => {
  const zoneHref = useZoneHref();
  const { guard: guardClosed, closedProps } = useStoreClosed();
  const rtl = useIsRtl();
  const dispatch = useDispatch();
  const router = useRouter();
  const setting = useSelector((state: any) => state.Setting);
  const city = useSelector((state: any) => state.City.city);
  const cityStatus = useSelector((state: any) => state.City.status);
  const shopMode = useSelector((state: any) => state.ShopMode.mode);
  const cart = useSelector((state: any) => state.Cart);

  const ratingsCount = 10;
  const [productDetails, setProductDetails] = useState<any>([]);
  const [selectVariant, setSelectVariant] = useState<any>(product?.variants?.[0]);
  const [ratingData, setRatingData] = useState<any>({});
  const [quantity, setQuantity] = useState(1);
  const [productImages, setProductImages] = useState<any[]>([]);
  const [selectedImage, setSelectedImage] = useState("");
  const [loading, setLoading] = useState(false);
  const [isVariantAvailable, setIsVariantAvailable] = useState(false);
  // Drives the like-button pop + burst animation. Auto-resets so it can replay.
  const [likeBurst, setLikeBurst] = useState(false);

  // `images` entries come as { image_url } objects (older payloads sent plain strings).
  const toImageUrl = (img) => (typeof img === "string" ? img : img?.image_url);

  // Variant label: prefer measurement+unit, else derive from attributes ("10 KG"), else name.
  const getVariantLabel = (variant) => {
    if (variant?.measurement) {
      const unit =
        variant?.unit?.translations?.short_code ?? variant?.unit?.short_code ?? "";
      return `${variant.measurement} ${unit}`.trim();
    }
    if (Array.isArray(variant?.attributes) && variant.attributes.length) {
      return variant.attributes
        .map((a) => `${a?.attribute_value} ${a?.attribute_name}`.trim())
        .join(", ");
    }
    // Fallback: the variant's own name. Many catalogues store it as the FULL
    // product name plus the distinguishing part ("<Product> - Pink"), which
    // renders a pill as wide as the panel and repeats what the heading already
    // says. Strip the product-name prefix so only the distinguishing part is
    // left; if that leaves nothing (the names are identical), keep the original.
    const name = (variant?.translations?.name ?? variant?.name ?? "").trim();
    // Try every name the product is known by — translated and raw, from the
    // fetched details and from the list payload. A translated variant name is
    // prefixed with the TRANSLATED product name, so comparing against only one
    // of them silently fails to match and the full name renders.
    const bases = [
      productDetails?.translations?.name,
      productDetails?.name,
      product?.translations?.name,
      product?.name,
    ]
      .map((n) => (n ?? "").trim())
      .filter(Boolean)
      // Longest first: strip the most specific prefix that matches.
      .sort((a, b) => b.length - a.length);

    for (const base of bases) {
      if (name.toLowerCase().startsWith(base.toLowerCase())) {
        // Also drop a leading separator left behind ("- Pink" → "Pink").
        const rest = name.slice(base.length).replace(/^[\s\-–—:,/|]+/, "").trim();
        if (rest) return rest;
      }
    }
    return name;
  };

  // Per-axis variant selection (Color / Size separately).
  const selectedAxisValue = (attrId) =>
    selectVariant?.attributes?.find((a) => a.attribute_id === attrId)
      ?.attribute_value_id;

  // Find the variant matching the current selection with one axis overridden.
  // Returns undefined when that combination doesn't exist as a variant.
  const findVariantForAxis = (attrId, valueId) => {
    const desired = {};
    (selectVariant?.attributes || []).forEach(
      (a) => (desired[a.attribute_id] = a.attribute_value_id)
    );
    desired[attrId] = valueId;
    const ids = Object.keys(desired).map(Number);
    return productDetails?.variants?.find((v) =>
      ids.every((id) =>
        v.attributes?.some(
          (a) => a.attribute_id === id && a.attribute_value_id === desired[id]
        )
      )
    );
  };

  // An axis value is selectable only if it combines with the other selected axes.
  const isAxisValueAvailable = (attrId, valueId) =>
    Boolean(findVariantForAxis(attrId, valueId));

  const handleSelectAxis = (attrId, valueId) => {
    const match = findVariantForAxis(attrId, valueId);
    if (match) handleChangeVariant(match);
  };

  // Lock page scroll while modal open (prevents the second, outer scrollbar).
  useEffect(() => {
    if (showDetailModal) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [showDetailModal]);

  const fetchProductById = async () => {
    setLoading(true);
    try {
      const res = await api.getProductById({
        latitude: city.latitude,
        longitude: city.longitude,
        id: product?.id,
      });
      setLoading(false);
      const data = res?.data;
      const firstVariant = data?.variants?.[0];
      const variantImages = (firstVariant?.images || [])
        .map(toImageUrl)
        .filter(Boolean);
      const baseImages = [
        data?.image_url,
        ...(data?.images || []).map(toImageUrl),
      ].filter(Boolean);
      const gallery = variantImages.length ? variantImages : baseImages;
      setProductImages(gallery);
      setSelectedImage(gallery[0] || data?.image_url || "");
      setProductDetails(data);
      if (firstVariant) setSelectVariant(firstVariant);
    } catch (error) {
      setLoading(true);
      console.log("error", error);
    }
  };

  const handleIsVariantAvailable = () => {
    if (product?.is_unlimited_stock == 0 && selectVariant?.stock <= 0) {
      setIsVariantAvailable(false);
    } else {
      setIsVariantAvailable(true);
    }
  };

  const handleChangeVariant = (variant) => {
    setSelectVariant(variant);
    // Swap the gallery to the picked variant's images (fall back to product images).
    const variantImages = (variant?.images || []).map(toImageUrl).filter(Boolean);
    const baseImages = [
      productDetails?.image_url,
      ...(productDetails?.images || []).map(toImageUrl),
    ].filter(Boolean);
    const gallery = variantImages.length ? variantImages : baseImages;
    setProductImages(gallery);
    setSelectedImage(gallery[0] || productDetails?.image_url || "");
  };

  const fetchRatings = async () => {
    try {
      const result = await api.getProductRatings({
        id: product?.id,
        limit: ratingsCount,
        offset: 0,
      });
      setRatingData(result?.data);
    } catch (error) {
      console.log("error", error);
    }
  };

  // Fetch full product detail + ratings when the modal opens for a product.
  useEffect(() => {
    if (showDetailModal && product?.id) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      fetchProductById();

      fetchRatings();
    }
    // fetchProductById/fetchRatings are redefined every render (close over
    // product/ratingsCount, neither memoized) — depending on them would
    // re-run this effect on unrelated renders instead of only when the
    // modal opens for a (possibly new) product.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showDetailModal, product?.id]);

  // Stock availability follows the currently selected variant.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    handleIsVariantAvailable();
    // handleIsVariantAvailable is redefined every render; only re-run this
    // for an actual variant/stock-mode change, not unrelated renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectVariant, product?.is_unlimited_stock]);

  const handleHideDetailModal = () => {
    setShowDetailModal(false);
  };

  // Units of this variant already in the cart. Selector picks how many MORE to add,
  // so the cap check is (alreadyInCart + selector qty), not selector alone.
  const variantCartQty =
    (cart?.isGuest
      ? cart?.guestCart
      : cart?.cartProducts
    )?.find(
      (prdct) =>
        prdct?.product_id == product?.id &&
        prdct?.product_variant_id == selectVariant?.id,
    )?.qty || 0;

  const handleAddToCart = async () => {
    let productQuantity = cart?.isGuest
      ? getProductQuantities(cart?.guestCart)
      : getProductQuantities(cart?.cartProducts);
    const isExisting = cart.guestCart.some(
      (cartProduct) =>
        cartProduct?.product_id == product?.id &&
        cartProduct?.product_variant_id == selectVariant?.id
    );
    const productQty = productQuantity?.find(
      (prdct) => prdct?.product_id == product?.id
    )?.qty;
    const cartProductQty = cart.cartProducts.find(
      (prdct) =>
        prdct?.product_id == product?.id &&
        selectVariant?.id == prdct?.product_variant_id
    );
    if (Number(product?.is_unlimited_stock) == 0 && selectVariant?.stock <= 0) {
      toast.error(t("out_of_stock_message"));
      return;
    }
    if (cart?.isGuest) {
      const totalQty = (productQty ?? 0) + quantity;
      const maxAddable = getMaxAddableQuantity({
        maxCartItemsCount: setting?.setting?.max_cart_items_count,
        otherLinesQty: getCartTotalQuantity(cart?.guestCart) - (productQty || 0),
        totalAllowedQty: product?.total_allowed_quantity,
        isUnlimitedStock: Number(product?.is_unlimited_stock) != 0,
        stock: selectVariant?.stock,
      });
      if (exceedsAllowedQty(totalQty, product?.total_allowed_quantity)) {
        toast.error(t("max_cart_limit_error"));
      } else if (totalQty > maxAddable) {
        toast.error(t("max_cart_limit_error"));
      } else if (isExisting) {
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
          product_id:product?.id,
          product_variant_id: selectVariant?.id,
          qty: quantity,
          productPrice: productPrice,
        };
        dispatch(addtoGuestCart({ data: [...(cart?.guestCart ?? []), productData] }));
        let products = [...(cart?.guestCart ?? []), productData];
        handleCalculateTotal(products);
        setQuantity(1);
        toast.success(t("product_added_successfully"));
      }
    } else {
      try {
        const totalQty = (productQty ?? 0) + quantity;
        const effectiveMaxQty = getMaxAddableQuantity({
          maxCartItemsCount: setting?.setting?.max_cart_items_count,
          otherLinesQty:
            getCartTotalQuantity(cart?.cartProducts) - (productQty || 0),
          totalAllowedQty: product?.total_allowed_quantity,
          isUnlimitedStock: Number(product?.is_unlimited_stock) != 0,
          stock: selectVariant?.stock,
        });
        if (exceedsAllowedQty(totalQty, product?.total_allowed_quantity)) {
          toast.error(t("max_cart_limit_error"));
        } else if (effectiveMaxQty <= 0 || totalQty > effectiveMaxQty) {
          toast.error(t("maximum_cart_quantity_reach"));
        } else {
          const response = await api.addToCart({
            product_id:product?.id,
            product_variant_id: selectVariant.id,
            qty: cartProductQty ? cartProductQty.qty + quantity : quantity,
            latitude: city?.latitude,
            longitude: city?.longitude,
          });
          if (response.status == 1) {
            if (cartProductQty) {
              const updatedProducts = cart.cartProducts.map((cartProduct) => {
                if (
                  cartProduct.product_id ==product?.id &&
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
                  product_id:product?.id,
                  product_variant_id: selectVariant?.id,
                  qty: quantity,
                },
              ];
              dispatch(setCartProducts({ data: productData }));
            }
            dispatch(setCart({ data: response }));
            dispatch(setCartSubTotal({ data: response.sub_total }));
            toast.success(t("product_added_successfully"));
          } else {
            toast.error(response.message);
          }
        }
      } catch (error) {
        console.log("Error", error);
      }
    }
  };

  const getProductQuantities = (products: any[]): { product_id: number; qty: number }[] => {
    return Object.entries(
      products?.reduce((quantities: Record<string, number>, product: any) => {
        const existingQty = quantities[product.product_id] || 0;
        return {
          ...quantities,
          [product.product_id]: existingQty + product.qty,
        };
      }, {})
    ).map(([productId, qty]) => ({
      product_id: Number.parseInt(productId),
      qty: qty as number,
    }));
  };
  const handleCalculateTotal = (products) => {
    const total = products.reduce((prev, curr) => {
      prev += curr.productPrice * curr.qty;
      return prev;
    }, 0);
    dispatch(setGuestCartTotal({ data: total }));
  };

  // Server stepper commit — same contract as ProductsList cards: rebuild
  // cartProducts from the server's authoritative cart array (NOT a closure-spread
  // snapshot) so fast +/- clicks can't drop a line, and drop stale out-of-order
  // responses via ctx.isStale().
  const serverAddToCart = async (qty, ctx) => {
    try {
      const response = await api.addToCart({
        product_id: product?.id,
        product_variant_id: selectVariant?.id,
        qty,
        latitude: city?.latitude,
        longitude: city?.longitude,
      });
      if (ctx?.isStale?.()) return;
      if (response.status === 1) {
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

  const serverRemoveFromCart = async (ctx, units = 1) => {
    try {
      const response = await api.removeFromCart({
        product_id: product?.id,
        product_variant_id: selectVariant?.id,
        qty: units,
      });
      if (ctx?.isStale?.()) return;
      // Removing the last unit 0-returns "no item found" even though it cleared
      // the row — treat that as a successful removal.
      const alreadyGone =
        response?.status !== 1 &&
        /not found|no item/i.test(response?.message || "");
      if (response?.status === 1 || alreadyGone) {
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

  // Guest carts are local-only (no debounce needed) — mutate redux instantly.
  const handleGuestIncrease = () => {
    if (
      exceedsAllowedQty(variantCartQty + 1, product?.total_allowed_quantity)
    ) {
      toast.error(t("max_cart_limit_error"));
      return;
    }
    if (
      Number(product?.is_unlimited_stock) == 0 &&
      variantCartQty >= selectVariant?.stock
    ) {
      toast.error(t("out_of_stock"));
      return;
    }
    const maxAddable = getMaxAddableQuantity({
      maxCartItemsCount: setting?.setting?.max_cart_items_count,
      otherLinesQty: getCartTotalQuantity(cart?.guestCart) - (variantCartQty || 0),
      totalAllowedQty: product?.total_allowed_quantity,
      isUnlimitedStock: Number(product?.is_unlimited_stock) != 0,
      stock: selectVariant?.stock,
    });
    if (variantCartQty >= maxAddable) {
      toast.error(t("max_cart_limit_error"));
      return;
    }
    const updated = cart.guestCart.map((cp) =>
      cp?.product_id == product?.id &&
      cp?.product_variant_id == selectVariant?.id
        ? { ...cp, qty: cp.qty + 1 }
        : cp
    );
    dispatch(addtoGuestCart({ data: updated }));
    handleCalculateTotal(updated);
  };

  const handleGuestDecrease = () => {
    const updated = cart.guestCart
      .map((cp) =>
        cp?.product_id == product?.id &&
        cp?.product_variant_id == selectVariant?.id
          ? { ...cp, qty: cp.qty - 1 }
          : cp
      )
      .filter((cp) => cp.qty > 0);
    dispatch(addtoGuestCart({ data: updated }));
    handleCalculateTotal(updated);
  };

  // Optimistic + in-flight-guarded wishlist toggle. Rapid clicks used to each
  // read the pre-response redux state and fire their own addToFavorite; the hook
  // flips redux on click and drops clicks while a call is running.
  const { liked, toggle: handleProductLikes } =
    useFavoriteToggle({
      productId: product?.id,
      onToggled: (nowLiked) => {
        // Pop + burst animation on a fresh like only (auto-reset so it replays).
        if (!nowLiked) return;
        setLikeBurst(true);
        setTimeout(() => setLikeBurst(false), 600);
      },
    });

  const handleChangeCoverImage = (image) => {
    setSelectedImage(image);
  };

  // Buy Now = add to cart, then jump to the cart page (closing the modal).
  const handleBuyNow = async () => {
    await handleAddToCart();
    setShowDetailModal(false);
    router.push(zoneHref("/cart"));
  };

  const calculateDiscount = (discountPrice, actualPrice) => {
    const difference = actualPrice - discountPrice;
    return (difference / actualPrice) * 100;
  };

  const { currency, decimals: decimalPoint } = useCurrency();

  // Discount badge (e.g. "10% OFF") + strike-through pricing.
  const hasDiscount =
    selectVariant?.discounted_price !== 0 &&
    selectVariant?.discounted_price !== selectVariant?.price;
  const discountLabel = hasDiscount
    ? `${calculateDiscount(
        selectVariant?.discounted_price,
        selectVariant?.price
      ).toFixed(decimalPoint)}% ${t("off")}`
    : null;

  // Delivery pill shows only on the Quick channel (with a set location). Prefer the
  // product/variant ETA; fall back to the global quick-delivery minutes.
  const quickDeliveryTime =
    setting?.setting?.web_settings?.delivery_time ||
    setting?.setting?.delivery_time ||
    10;
  const showQuickDelivery = shopMode === "quick" && cityStatus === "fulfill";
  const deliveryLabel =
    selectVariant?.time_to_deliver ||
    productDetails?.time_to_deliver ||
    `${t("delivery_in")} ${quickDeliveryTime} ${t("minutes")}`;



  // Stepper ceiling: smaller of remaining store-wide cart capacity, the
  // per-product allowed quantity, and stock (when limited).
  const maxQty = getMaxAddableQuantity({
    maxCartItemsCount: setting?.setting?.max_cart_items_count,
    otherLinesQty:
      getCartTotalQuantity(cart?.cartProducts) - (variantCartQty || 0),
    totalAllowedQty: product?.total_allowed_quantity,
    isUnlimitedStock: Number(product?.is_unlimited_stock) != 0,
    stock: selectVariant?.stock,
  });

  // Same cap, sourced from the guest cart instead of the server cart.
  const guestMaxQty = getMaxAddableQuantity({
    maxCartItemsCount: setting?.setting?.max_cart_items_count,
    otherLinesQty:
      getCartTotalQuantity(cart?.guestCart) - (variantCartQty || 0),
    totalAllowedQty: product?.total_allowed_quantity,
    isUnlimitedStock: Number(product?.is_unlimited_stock) != 0,
    stock: selectVariant?.stock,
  });

  // Debounced optimistic stepper for the SERVER cart (guest carts use the instant
  // handlers above). Same hook/contract as the ProductsList product cards.
  const {
    displayQty: serverDisplayQty,
    increment: serverIncrement,
    decrement: serverDecrement,
  } = useDebouncedQuantity({
    serverQty: variantCartQty || 0,
    onCommit: (qty, ctx) => serverAddToCart(qty, ctx),
    onRemove: (units = 1, ctx) => serverRemoveFromCart(ctx, units),
    max: Number.isFinite(maxQty) ? maxQty : undefined,
    onMax: () =>
      toast.error(t("max_cart_limit_error"), {
        toastId: "max_cart_limit_error",
      }),
  });

  const stepperQty = cart?.isGuest ? variantCartQty : serverDisplayQty;
  const showStepper = stepperQty > 0;
  const handleStepperIncrease = () =>
    cart?.isGuest ? handleGuestIncrease() : serverIncrement();
  const handleStepperDecrease = () =>
    cart?.isGuest ? handleGuestDecrease() : serverDecrement();
  const handleStepperAdd = () =>
    cart?.isGuest ? handleAddToCart() : serverIncrement();

  const returnDaysCount = Number(productDetails?.return_days);
  const returnDaysLabel = returnDaysCount === 1 ? t("day") : t("days");
  const returnableText =
    returnDaysCount === 0
      ? t("easy_return")
      : `${t("returnable")} ${productDetails?.return_days} ${returnDaysLabel}`;
  const returnStatusText =
    productDetails?.return_status != 1 ? t("non-returnable") : returnableText;

  return (

      <Dialog open={showDetailModal}>
        <DialogContent
          dir={rtl ? "rtl" : "ltr"}
          className="custom-scrollbar w-full max-w-xl lg:max-w-screen-lg overflow-y-auto max-h-[92dvh] md:max-h-[90vh] rounded-t-2xl md:rounded-2xl !p-0 top-auto bottom-0 translate-y-0 md:top-[50%] md:bottom-auto md:translate-y-[-50%]"
          // Heading is the product name, which is absent while loading — fall
          // back to a generic label so the dialog is never nameless.
          title={
            productDetails?.translations?.name ??
            productDetails?.name ??
            t("product")
          }
        >
          <button
          type="button"
            className="sticky top-4 z-30 ms-auto me-4 mt-4 -mb-12 closeButtonBg rounded-full p-[8px] gap-[4px] cursor-pointer"
            onClick={handleHideDetailModal}
          >
            <RiCloseFill size={22} />
          </button>
          <div className=" ">
            {loading ? (
              <div className="flex items-center justify-center min-h-[60dvh] md:min-h-[420px] w-full">
                <Loader background="transparent" />
              </div>
            ) : (
              <div className="flex flex-col justify-center md:justify-start mx-auto">
                <div className="sticky top-0 z-20 bg-background px-4 pt-4 pb-4 md:px-6 md:pt-6 border-b-2 rounded-t-2xl md:rounded-t-2xl">
                  <h2 className="font-bold text-xl md:text-2xl break-words pe-10">
                    {productDetails?.translations?.name ?? productDetails?.name}
                  </h2>
                  <FewLeftBadge
                    variant={selectVariant}
                    product={productDetails}
                    size={14}
                    className="!text-sm !font-bold"
                  />
                  {/* No rating here. The detail body already renders one (with
                      half-stars, the /5.0 figure and the review count), so a
                      second copy in the sticky header showed the same score
                      twice on screen at once. */}
                  <div className="flex items-center gap-1 flex-wrap">
                    {/* The divider that used to sit here separated FSSAI from
                        the rating. With the rating gone it would be a border
                        with nothing on its left, so it goes too. */}
                    {productDetails?.fssai_lic_no && (
                      <div className="flex items-center gap-3 ">
                        <div className="text-xs">
                          {productDetails?.fssai_lic_img && (
                            <Image
                              width={36}
                              height={36}
                              src={productDetails?.fssai_lic_img}
                              className="object-contain"
                              alt="fssaiImage"
                            />
                          )}
                        </div>
                        <div className="text-xs">
                          {t("fssai_license_no")} {productDetails?.fssai_lic_no}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-12 px-4 md:px-6 mt-6 gap-3 pb-6 justify-center">
                  <div className="lg:col-span-6 col-span-12">
                    <div className="relative aspect-square h-auto w-full max-w-[280px] md:max-w-[360px] lg:max-w-none mx-auto">
                      <ImageWithPlaceholder
                        src={selectedImage}
                        alt={productDetails.name}
                        className="h-full w-full aspect-square rounded-sm"
                        width={424}
                        height={424}
                        quality={75}
                      />

                      <button
                        type="button"
                        onClick={handleProductLikes}
                        aria-label="wishlist"
                        className="like-btn absolute right-2 top-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white dark:bg-zinc-800 shadow-md transition-transform hover:bg-gray-50 dark:hover:bg-zinc-700 hover:scale-110 active:scale-90"
                      >
                        {/* Myntra-style heart burst — ring flash + 6 radiating particles. */}
                        {likeBurst && (
                          <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                            {[0, 1, 2, 3, 4, 5].map((i) => (
                              <span
                                key={i}
                                className="like-particle"
                                style={{ "--i": i } as React.CSSProperties}
                              />
                            ))}
                          </span>
                        )}
                        <span
                          className={`relative z-10 flex items-center justify-center ${
                            likeBurst ? "like-pop" : ""
                          }`}
                        >
                          {liked ? (
                            <BiSolidHeart
                              size={20}
                              className="primaryFilledColor"
                            />
                          ) : (
                            <BiHeart size={20} className="text-gray-500" />
                          )}
                        </span>
                      </button>
                    </div>
                    <div className="mt-[10px]">
                      <Swiper
                        key={String(rtl)}
                        spaceBetween={10}
                        modules={[Navigation]}
                        className="brand-swiper"
                        breakpoints={{
                          1200: {
                            slidesPerView: 6,
                          },
                          1024: {
                            slidesPerView: 5,
                          },
                          768: {
                            slidesPerView: 5,
                          },
                          375: {
                            slidesPerView: 4.5,
                          },
                          0: {
                            slidesPerView: 4,
                          },
                        }}
                      >
                        {productImages?.map((image) => (
                          <SwiperSlide key={image}>
                            <button
                              type="button"
                              onClick={() => handleChangeCoverImage(image)}
                              className={`relative aspect-square w-full overflow-hidden rounded-lg border-2 bg-white dark:bg-zinc-800 ${
                                selectedImage === image
                                  ? "primaryBorder"
                                  : "border-[#DFE3E8] dark:border-zinc-700"
                              }`}
                            >
                              <ImageWithPlaceholder
                                src={image}
                                alt={productDetails.name}
                                height={90}
                                width={90}
                                className="h-full w-full object-contain p-1"
                              />
                            </button>
                          </SwiperSlide>
                        ))}
                      </Swiper>
                    </div>
                  </div>
                  <div className="col-span-12 lg:col-span-6">
                    <div className="relative flex flex-col gap-3">
                      {/* Brand — inline, name highlighted. */}
                      {productDetails?.brand_name && (
                        <div className="flex items-center gap-1.5 text-sm">
                          <span className="text-gray-500 dark:text-zinc-400">
                            {t("brand")}
                          </span>
                          <span className="font-semibold primaryColor">
                            {productDetails?.brand_name}
                          </span>
                        </div>
                      )}

                      {/* Rating — only when ratings are enabled AND there's at least one. */}
                      {product?.product_rating &&
                        (ratingData?.average_rating > 0 ||
                          productDetails?.rating_count > 0) && (
                          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400">
                            <div className="flex">
                              {[1, 2, 3, 4, 5].map((star) => {
                                const roundedRating =
                                  Math.round(
                                    (ratingData?.average_rating || 0) * 2
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
                              ({productDetails?.rating_count || 0} {t("reviews")})
                            </span>
                          </div>
                        )}

                      {/* Price (left) + delivery pill (right) */}
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-baseline gap-3">
                          <span className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-zinc-100">
                            {currency}
                            {hasDiscount
                              ? selectVariant?.discounted_price
                              : selectVariant?.price}
                          </span>
                          {hasDiscount && (
                            <span className="text-lg font-medium text-gray-400 dark:text-zinc-500 line-through">
                              {currency}
                              {selectVariant?.price}
                            </span>
                          )}
                          {discountLabel && (
                            <span className="rounded-md bg-green-100 px-2 py-1 text-xs font-bold uppercase text-green-700">
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
                                className={`primaryColor ${rtl ? "-scale-x-100" : ""}`}
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
                        product={productDetails}
                        size={14}
                        className="!text-sm !font-bold"
                      />

                      {/* Short description */}
                      {productDetails?.short_description && (
                        <p className="text-base font-normal leading-6 text-gray-600 dark:text-zinc-300">
                          {productDetails?.short_description}
                        </p>
                      )}

                      {/* Variant selector — one row per axis (Color, Size, …) */}
                      {productDetails?.variants?.length > 1 &&
                        (Array.isArray(productDetails?.variant_axes) &&
                        productDetails.variant_axes.length ? (
                          <div className="flex flex-wrap gap-x-6 gap-y-3">
                            {productDetails.variant_axes.map((axis) => {
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
                                      const isSel =
                                        sel === val.attribute_value_id;
                                      const isAvailable =
                                        isSel ||
                                        isAxisValueAvailable(
                                          axis.attribute_id,
                                          val.attribute_value_id
                                        );
                                      const unavailableVariantButtonClass =
                                        !isAvailable
                                          ? "cursor-not-allowed border-gray-200 dark:border-zinc-800 text-gray-300 dark:text-zinc-600 line-through opacity-60"
                                          : "border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-200 hover:border-gray-400";
                                      const variantButtonClass = isSel
                                        ? "primaryBorder primaryLightBack primaryColor dark:bg-white/10 dark:text-white dark:border-white"
                                        : unavailableVariantButtonClass;
                                      return (
                                        <button
                                          key={val.attribute_value_id}
                                          type="button"
                                          disabled={!isAvailable}
                                          title={
                                            isAvailable
                                              ? undefined
                                              : t("variantNotAvailable")
                                          }
                                          onClick={() =>
                                            handleSelectAxis(
                                              axis.attribute_id,
                                              val.attribute_value_id
                                            )
                                          }
                                          className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition ${variantButtonClass}`}
                                        >
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
                              {productDetails?.variants?.map((variant) => (
                                <button
                                  key={variant.id}
                                  type="button"
                                  onClick={() => handleChangeVariant(variant)}
                                  title={getVariantLabel(variant)}
                                  // Wraps rather than truncating: a cut-off label
                                  // ("SareeHB Woven Banarasi …") tells the user
                                  // nothing about which variant it is. Capped so
                                  // one pill can't span the whole panel.
                                  className={`max-w-full whitespace-normal break-words text-start rounded-2xl border px-5 py-2 text-sm font-medium transition ${
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

                      {/* Actions — Add to Cart doubles as an inline stepper once
                          the item is in the cart (quick-commerce style). */}
                      <div className="flex flex-col gap-2">
                        {isVariantAvailable ? (
                          <div className="flex flex-wrap items-stretch gap-2.5">
                            {showStepper ? (
                              <div
                                {...closedProps}
                                className={`flex h-12 flex-1 sm:flex-none sm:w-[180px] items-center justify-between rounded-lg primaryBackColor px-1.5 text-white shadow-sm ${closedProps.className ?? ""}`}
                              >
                                <button
                                  type="button"
                                  aria-label={t("decrease") || "decrease"}
                                  onClick={handleStepperDecrease}
                                  className="flex h-9 w-9 items-center justify-center rounded-md text-lg transition hover:bg-white/20 active:scale-90"
                                >
                                  <FiMinus />
                                </button>
                                <span className="min-w-[40px] text-center text-base font-bold tabular-nums">
                                  {stepperQty}
                                </span>
                                <button
                                  type="button"
                                  disabled={
                                    cart?.isGuest
                                      ? stepperQty >= guestMaxQty
                                      : stepperQty >= maxQty
                                  }
                                  aria-disabled={
                                    cart?.isGuest
                                      ? stepperQty >= guestMaxQty
                                      : stepperQty >= maxQty
                                  }
                                  aria-label={t("increase") || "increase"}
                                  onClick={guardClosed(handleStepperIncrease)}
                                  className="flex h-9 w-9 items-center justify-center rounded-md text-lg transition hover:bg-white/20 active:scale-90 disabled:opacity-40"
                                >
                                  <FiPlus />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={guardClosed(handleStepperAdd)}
                                {...closedProps}
                                className={`group flex h-12 flex-1 sm:flex-none sm:w-[180px] items-center justify-center gap-2 whitespace-nowrap rounded-lg border-2 primaryBorder primaryColor dark:text-white dark:border-white/40 px-4 text-sm font-bold transition hover:primaryBackColor hover:text-white hover:border-transparent active:scale-95 ${closedProps.className ?? ""}`}
                              >
                                <MdAddShoppingCart
                                  size={18}
                                  className="transition-transform group-hover:scale-110"
                                />
                                {t("add_to_cart")}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={guardClosed(handleBuyNow)}
                              {...closedProps}
                              className={`flex h-12 flex-1 sm:flex-none sm:w-[150px] items-center justify-center whitespace-nowrap rounded-lg primaryBackColor px-4 text-sm font-bold text-white shadow-sm transition hover:opacity-90 active:scale-95 ${closedProps.className ?? ""}`}
                            >
                              {t("buy_now")}
                            </button>
                          </div>
                        ) : (
                          <output className="inline-flex w-fit items-center gap-1.5 rounded-full border border-red-200 bg-red-50 dark:border-red-500/40 dark:bg-red-500/10 px-3 py-1.5 text-xs font-bold text-red-600 dark:text-red-400">
                            <MdRemoveShoppingCart size={14} className="shrink-0" />
                            {t("out_of_stock")}
                          </output>
                        )}
                      </div>

                      {/* Trust badges — all in one line: centered icon + label, divided. */}
                      <div className={`flex items-stretch divide-x divide-gray-200 dark:divide-zinc-700 rounded-xl border border-gray-200 dark:border-zinc-700 py-3 ${rtl ? "divide-x-reverse" : ""}`}>
                        {(() => {
                          const typeMeta = getProductTypeMeta(
                            productDetails?.product_type ??
                              productDetails?.indicator
                          );
                          if (!typeMeta) return null;
                          // `Icon` is not part of ProductTypeMeta — every case in
                          // getProductTypeMeta sets `svg`, so this fallback branch
                          // is dead at runtime today. Kept via `as any` rather than
                          // removed, to avoid a behavior-shape change in this pass.
                          const { svg, Icon, labelKey, color } = typeMeta as any;
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
                              productDetails?.cancelable_status == 1
                                ? CancelIcon
                                : NotCancelIcon
                            }
                            alt="cancelable"
                            className="h-8 w-8"
                          />
                          <span className="text-[11px] font-semibold leading-tight text-gray-700 dark:text-zinc-200">
                            {productDetails?.cancelable_status == 1
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
                                      ? productDetails?.till_status_quick
                                      : productDetails?.till_status_ecommerce
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
                              productDetails?.return_status == 1
                                ? ReturnIcon
                                : NoReturnIcon
                            }
                            alt="returnable"
                            className="h-8 w-8"
                          />
                          <span className="text-[11px] font-semibold leading-tight text-gray-700 dark:text-zinc-200">
                            {returnStatusText}
                          </span>
                        </div>

                        {productDetails?.cod_allowed == 1 && (
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
                      {Number(productDetails?.product_type) === 5 &&
                        productDetails?.prescription_note && (
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
                                {productDetails?.prescription_note?.replaceAll(
                                  "**",
                                  ""
                                )}
                              </span>
                            </div>
                          </div>
                        )}

                      {/* Meta */}
                      <div className="flex flex-col gap-3 text-sm">
                        {productDetails?.category_name && (
                          <div className="flex gap-2">
                            <span className="shrink-0 whitespace-nowrap font-semibold">
                              {t("category")} :
                            </span>
                            <span className="text-gray-600 dark:text-zinc-300">
                              {productDetails?.category_name}
                            </span>
                          </div>
                        )}
                        {productDetails?.tag_names && (
                          <div className="flex gap-2">
                            <span className="shrink-0 whitespace-nowrap font-semibold">
                              {t("tag")} :
                            </span>
                            <span className="text-gray-600 dark:text-zinc-300">
                              {Array.isArray(productDetails?.tag_names)
                                ? productDetails.tag_names.join(", ")
                                : productDetails?.tag_names}
                            </span>
                          </div>
                        )}
                        {productDetails?.made_in?.name && (
                          <div className="flex gap-2">
                            <span className="shrink-0 whitespace-nowrap font-semibold">
                              {t("made_in")} :
                            </span>
                            <span className="text-gray-600 dark:text-zinc-300">
                              {productDetails?.made_in?.name}
                            </span>
                          </div>
                        )}
                        {productDetails?.store_name && (
                          <div className="flex gap-2">
                            <span className="shrink-0 whitespace-nowrap font-semibold">
                              {t("sold_by")} :
                            </span>
                            <span className="text-gray-600 dark:text-zinc-300">
                              {productDetails?.store_name}
                            </span>
                          </div>
                        )}
                        {productDetails?.manufacturer && (
                          <div className="flex gap-2">
                            <span className="shrink-0 whitespace-nowrap font-semibold">
                              {t("manufacturer")} :
                            </span>
                            <span className="text-gray-600 dark:text-zinc-300">
                              {productDetails?.manufacturer}
                            </span>
                          </div>
                        )}
                        {productDetails?.fssai_lic_no && (
                          <div className="flex items-center gap-2">
                            <span className="shrink-0 whitespace-nowrap font-semibold">
                              {t("fssai_license_no")}
                            </span>
                            {productDetails?.fssai_lic_img && (
                              <Image
                                width={100}
                                height={100}
                                src={productDetails?.fssai_lic_img}
                                className="w-9 h-9 object-contain"
                                alt="fssaiImage"
                              />
                            )}
                            <span className="text-gray-600 dark:text-zinc-300">
                              {productDetails?.fssai_lic_no}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Specifications — fully dynamic from the variant's custom_sections. */}
                {Array.isArray(selectVariant?.custom_sections) &&
                  selectVariant.custom_sections.length > 0 && (
                    <div className="rounded-sm mx-4 md:mx-6 mb-6 cardBorder p-4 flex flex-col gap-5">
                      <h2 className="text-lg md:text-xl font-bold textColor">
                        {t("specifications")}
                      </h2>
                      {selectVariant.custom_sections.map((section) => (
                        <div
                          key={section?.section_id}
                          className="flex flex-col gap-2"
                        >
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
                                <span className="w-full sm:w-56 sm:shrink-0 text-sm font-medium text-gray-600 dark:text-zinc-300">
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
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

  );
};

export default ProductDetailModal;
