import React, { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { RiCloseFill } from "react-icons/ri";
import { t } from "@/utils/translation";
import { formatCustomDate } from "@/lib/utils";
import * as api from "@/api/apiRoutes";
import { BiPhoneCall } from "react-icons/bi";
import { IoLocationOutline } from "react-icons/io5";
import { LuTruck, LuBike, LuClock } from "react-icons/lu";
import Link from "next/link";
// The `?url` webpack/Next asset resource query has no bundled type
// declaration (next/image-types/global only covers plain .svg/.png imports),
// so these two resolve to `any` here purely for TS — same runtime value as
// before this file was typed.
// @ts-expect-error - `?url`-suffixed asset import has no type declaration
import userIcon from "@/assets/customer_location.svg?url";
// @ts-expect-error - `?url`-suffixed asset import has no type declaration
import deliveryBoyIcon from "@/assets/delivery_boy.png?url";
import MapWrapper from "@/components/maps/MapWrapper";
import type { MapMarker } from "@/components/maps/types";
import Loader from "@/components/loader/Loader";
import DeliveryChat from "@/components/chat/delivery/DeliveryChat";
import Image from "next/image";
import {
  parseDeliverTimeToMs,
  getRemainingMs,
  formatMsAsMinutes,
} from "@/utils/orderDeliveryTime";

interface LatLng {
  lat: number | null;
  lng: number | null;
}

interface RoutePoint {
  latitude: number;
  longitude: number;
}

interface LiveTrackingModalProps {
  showLiveTracking: boolean;
  setShowLiveTracking: (open: boolean) => void;
  order: any;
}

const LiveTrackingModal = ({
  showLiveTracking,
  setShowLiveTracking,
  order,
}: LiveTrackingModalProps) => {
  const [riderLocation, setRiderLocation] = useState<LatLng | undefined>();
  const [userLocation, setUserLocation] = useState<LatLng>({
    lat: null,
    lng: null,
  });
  // True once a delivery boy is actually assigned to this order — the map
  // shows the STORE's location before this (order is still being prepared)
  // and switches to the rider's live location once assigned.
  const isDeliveryBoyAssigned = Boolean(order?.delivery_boy_name);

  // Pre-assignment ETA countdown, anchored to order.created_at so it's
  // always correct regardless of when the modal is opened/reopened — never
  // a locally-decremented timer. Ticks once a second purely to re-render;
  // the remaining time itself is always recomputed from the anchor.
  const totalDeliverMs = parseDeliverTimeToMs(order?.total_deliver_time);
  const showCountdown =
    !isDeliveryBoyAssigned && !!order?.created_at && totalDeliverMs != null;
  // `now` (not a bare tick counter) so Date.now() is read inside the effect's
  // callback — an external-system read triggered by the interval, not called
  // impurely during render — and the countdown math below stays a pure
  // function of props + this state.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!showCountdown) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [showCountdown]);
  const remainingDeliverMs =
    showCountdown && order?.created_at && totalDeliverMs != null
      ? getRemainingMs(order.created_at, totalDeliverMs, now)
      : 0;

  // store_latitude/store_longitude live on the order ITEM, not the order
  // itself (verified against a live order-detail response) — every item
  // shares the same store, so the first is enough.
  const storeLat = Number.parseFloat(order?.items?.[0]?.store_latitude);
  const storeLng = Number.parseFloat(order?.items?.[0]?.store_longitude);
  const hasStoreLocation = Number.isFinite(storeLat) && Number.isFinite(storeLng);
  // Ecommerce orders ship (no live rider to track) and carry
  // estimated_delivery_date instead of preparation_time/time_to_deliver —
  // its presence is the reliable signal since this modal is shared by both
  // the Quick (OrderDetail) and Ecom (EcomOrderDetail) pages.
  const isEcommerceOrder = Boolean(order?.estimated_delivery_date);
  // Road-following rider->user path from OSRM (falls back to the straight
  // line below while it's loading or if the request fails).
  const [routePath, setRoutePath] = useState<RoutePoint[] | null>(null);

  // The rider's photo isn't on the order object — it's only in the chat
  // conversation's payload (POST /chat/start_order). Fetched once per order,
  // purely for the avatar; DeliveryChat below independently starts its own
  // conversation for messaging.
  const [riderAvatar, setRiderAvatar] = useState<string | null>(null);
  useEffect(() => {
    if (!showLiveTracking || !isDeliveryBoyAssigned || !order?.id) return;
    let active = true;
    api
      .startOrderChat({ order_id: order.id, order_item_id: order?.order_item_id })
      .then((res: any) => {
        if (active && res?.data?.avatar) setRiderAvatar(res.data.avatar);
      })
      .catch((error: any) => console.log("startOrderChat error", error));
    return () => {
      active = false;
    };
  }, [showLiveTracking, isDeliveryBoyAssigned, order?.id, order?.order_item_id]);

  const [showOverlay, setShowOverlay] = useState(false);
  // "Picked Up" assigns delivery_boy_name to the order BEFORE the rider
  // actually starts the ride / reports GPS — liveOrderTracking legitimately
  // answers status==0 for that whole gap, and it isn't an error: the store
  // marker/route below covers it. Once a real fix DOES arrive, any later
  // status==0 means tracking genuinely broke (rider was moving, signal
  // lost) — that's when the hard error overlay should actually show. This
  // flips permanently true on first fix and is reset per-order below.
  const [hasEverHadRiderFix, setHasEverHadRiderFix] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets the "ever tracked" flag when a different order's modal opens
    setHasEverHadRiderFix(false);
  }, [order?.id]);
  // Live ETA from the tracking endpoint itself — distinct from (and fresher
  // than) order.time_to_deliver, which is only a snapshot from order fetch.
  const [liveTimeToDeliver, setLiveTimeToDeliver] = useState<string | null>(
    null,
  );
  const fetchLocation = useCallback(async () => {
    // No delivery boy assigned yet → nothing to poll.
    if (!isDeliveryBoyAssigned) return;
    try {
      const res: any = await api.liveOrderTracking({ orderId: order?.id });
      if (res.status == 0) {
        // Only a real error once we've actually had a rider fix before —
        // pre-ride-start this is expected and the store fallback covers it.
        setShowOverlay(hasEverHadRiderFix);
      } else {
        const latitude = Number.parseFloat(res?.data?.latitude);
        const longitude = Number.parseFloat(res?.data?.longitude);
        setRiderLocation({ lat: latitude, lng: longitude });
        setShowOverlay(false);
        setHasEverHadRiderFix(true);
        if (res?.data?.time_to_deliver) {
          setLiveTimeToDeliver(res.data.time_to_deliver);
        }
      }
    } catch (error) {
      console.log("error", error);
    }
  }, [order, isDeliveryBoyAssigned, hasEverHadRiderFix]);

  useEffect(() => {
    if (showLiveTracking) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-open pattern; not derivable from render
      fetchLocation();
    }
  }, [showLiveTracking, fetchLocation]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (showLiveTracking) {
      interval = setInterval(() => {
        fetchLocation();
      }, 5000);
    }
    return () => {
      clearInterval(interval);
    };
  }, [showLiveTracking, fetchLocation, order?.id]);

  useEffect(() => {
    // Quick rows carry latitude/longitude flat on `order`; ecom rows nest them
    // under `order.address`/`order.order_address` (same object as the
    // name/mobile/address fields handled below).
    const rawAddr = order?.address ?? order?.order_address;
    const lat = order?.latitude ?? rawAddr?.latitude;
    const lng = order?.longitude ?? rawAddr?.longitude;
    if (lat && lng) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- derives user location from order prop
      setUserLocation({
        lat: Number.parseFloat(lat),
        lng: Number.parseFloat(lng),
      });
    }
  }, [order]);

  const handleHideLiveTracking = () => {
    setShowLiveTracking(false);
  };

  // When live tracking is unavailable the map is just an empty grey box wasting
  // space — shrink it right down so the details below take the focus.
  const mapHeight = showOverlay ? "180px" : "calc(45vh - 100px)";

  // The modal is shared by Quick (OrderDetail) and Ecom (EcomOrderDetail). Quick
  // rows carry `address`/`mobile` as strings; ecom rows carry a nested address
  // OBJECT ({name, address, mobile, ...}) — never render the object directly.
  const rawAddress = order?.address ?? order?.order_address ?? "";
  const deliveryAddress =
    typeof rawAddress === "object" && rawAddress !== null
      ? rawAddress?.address || ""
      : rawAddress;
  const deliveryMobile =
    (typeof rawAddress === "object" && rawAddress !== null
      ? rawAddress?.mobile
      : null) ||
    order?.mobile ||
    order?.order_mobile ||
    "";
  const customerName =
    (typeof rawAddress === "object" && rawAddress !== null
      ? rawAddress?.name
      : null) ||
    order?.name ||
    order?.user_name ||
    "";

  const hasRider = riderLocation?.lat != null && riderLocation?.lng != null;
  const hasUser = userLocation?.lat != null && userLocation?.lng != null;
  // Store endpoint for the OSRM route/marker — covers both before assignment
  // AND after "Picked Up" while the rider hasn't started the ride yet (no
  // GPS fix reported so far). hasEverHadRiderFix is what actually flips this
  // off: once tracking has produced one real rider position, a later gap
  // means tracking genuinely broke, and the store fallback should stop
  // (silently showing "at the store" for an order that's already moving
  // would be misleading) — see the error-overlay gating on it below.
  const hasStoreRoute = !hasRider && !hasEverHadRiderFix && hasStoreLocation;

  // Road-following route via OSRM's public demo server (no API key).
  // Refetches whenever the rider's position moves (it comes from the 5s poll
  // above) — or, pre-assignment, once for the store->user leg (store coords
  // are static, so no polling needed there).
  useEffect(() => {
    if (!hasUser || (!hasRider && !hasStoreRoute)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clears stale route when rider/user/store coords become unavailable
      setRoutePath(null);
      return;
    }
    let active = true;
    const originLat = hasRider ? riderLocation!.lat : storeLat;
    const originLng = hasRider ? riderLocation!.lng : storeLng;
    const coords = `${originLng},${originLat};${userLocation.lng},${userLocation.lat}`;
    fetch(
      `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`,
    )
      .then((res) => res.json())
      .then((data: any) => {
        if (!active) return;
        const coordinates = data?.routes?.[0]?.geometry?.coordinates;
        if (Array.isArray(coordinates) && coordinates.length > 1) {
          setRoutePath(
            coordinates.map(([lng, lat]: [number, number]) => ({
              latitude: lat,
              longitude: lng,
            })),
          );
        } else {
          setRoutePath(null);
        }
      })
      .catch((error) => {
        console.log("OSRM route fetch failed", error);
        if (active) setRoutePath(null);
      });
    return () => {
      active = false;
    };
    // riderLocation itself (not just its lat/lng) is read at line ~247 via a
    // non-null assertion, but only when hasRider is true — its lat/lng are
    // already tracked below, and the object reference otherwise changes on
    // every poll tick without the actual coordinates changing, which would
    // refetch OSRM needlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    hasRider,
    hasUser,
    hasStoreRoute,
    riderLocation?.lat,
    riderLocation?.lng,
    userLocation?.lat,
    userLocation?.lng,
    storeLat,
    storeLng,
  ]);

  // Store's location covers every phase before we have a real rider fix —
  // pre-assignment ("order is being prepared") AND assigned-but-not-yet-moving
  // (delivery boy assigned but liveOrderTracking hasn't reported a position
  // yet, e.g. status==0 below). The rider marker only takes over once it
  // actually has coordinates. Reuses hasStoreRoute's same condition.
  const showStoreMarker = hasStoreRoute;

  // Markers + rider/store->user path for MapWrapper (provider-agnostic).
  const markers: MapMarker[] = [
    hasRider && {
      latitude: riderLocation!.lat as number,
      longitude: riderLocation!.lng as number,
      iconUrl: deliveryBoyIcon?.src,
      title: order?.delivery_boy_name,
    },
    showStoreMarker && {
      latitude: storeLat,
      longitude: storeLng,
      title: order?.items?.[0]?.store_name || t("store") || "Store",
    },
    hasUser && {
      latitude: userLocation.lat as number,
      longitude: userLocation.lng as number,
      iconUrl: userIcon?.src,
    },
  ].filter(Boolean) as MapMarker[];

  // Road-following route when available; straight line as a fallback while
  // OSRM is loading or if the request fails. Same rider<->user logic covers
  // store<->user before assignment (the OSRM effect below keys off hasRider,
  // so the fallback straight line is what draws pre-assignment).
  const polyline: MapMarker[] | undefined =
    routePath ??
    (hasRider && hasUser
      ? [
          { latitude: riderLocation!.lat as number, longitude: riderLocation!.lng as number },
          { latitude: userLocation.lat as number, longitude: userLocation.lng as number },
        ]
      : showStoreMarker && hasUser
        ? [
            { latitude: storeLat, longitude: storeLng },
            { latitude: userLocation.lat as number, longitude: userLocation.lng as number },
          ]
        : undefined);

  // Center on the rider; store while awaiting assignment; fall back to user.
  // MapWrapper needs valid coords.
  const centerLat = hasRider
    ? riderLocation?.lat
    : showStoreMarker
      ? storeLat
      : userLocation.lat;
  const centerLng = hasRider
    ? riderLocation?.lng
    : showStoreMarker
      ? storeLng
      : userLocation.lng;

  return (
    <Dialog open={showLiveTracking} onOpenChange={setShowLiveTracking}>
      <DialogContent
        className="w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        title={t("livetracking")}
      >
        <DialogHeader className="shrink-0 flex flex-row items-start justify-between">
          <div>
            <span className="flex items-center gap-2 text-2xl font-bold text-start">
              {t("livetracking")}
              {!isEcommerceOrder && (
                <span className="relative flex h-2.5 w-2.5 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
                </span>
              )}
            </span>
            <p className="mt-0.5 text-sm SecondaryTextColor">
              {t("track_your_order_realtime") || "Track your order in real-time"}
            </p>
            {showCountdown && (
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-full primaryLightBack primaryColor px-3 py-1 text-xs font-semibold">
                <LuClock size={13} className="shrink-0" />
                {remainingDeliverMs <= 0
                  ? t("reaching_you_soon") || "Reaching you soon"
                  : `${t("estimated_delivery_time") || "Estimated delivery"}: ${formatMsAsMinutes(remainingDeliverMs)}`}
              </div>
            )}
          </div>
          <div className="closeButtonBg shrink-0 rounded-full p-[8px] gap-[4px] cursor-pointer">
            <RiCloseFill size={22} onClick={handleHideLiveTracking} />
          </div>
        </DialogHeader>
        <div className="flex flex-col gap-4 overflow-y-auto pr-1 -mr-1">
          {/* Ecommerce orders ship — no live rider to track, show the
              estimated delivery date instead of the map. */}
          {isEcommerceOrder && (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-[var(--border-color)] p-8 text-center">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full primaryLightBack primaryColor">
                <LuTruck size={26} />
              </span>
              <div>
                <p className="text-sm SecondaryTextColor">
                  {t("estimated_delivery") || "Estimated Delivery"}
                </p>
                <p className="mt-1 text-lg font-bold textColor">
                  {order?.estimated_delivery_date}
                </p>
              </div>
            </div>
          )}

          {/* Map — rounded, bordered. Live ping badge when the rider is moving.
              Quick-channel orders only (ecommerce shows the estimate above). */}
          {!isEcommerceOrder && (
          <div className="w-full">
            <div className="relative overflow-hidden rounded-xl border border-[var(--border-color)]">
              {centerLat != null && centerLng != null ? (
                <MapWrapper
                  latitude={centerLat}
                  longitude={centerLng}
                  zoom={15}
                  height={mapHeight}
                  markers={markers}
                  polyline={polyline}
                  showCenterMarker={false}
                  fitToMarkers
                />
              ) : (
                <div
                  className="flex items-center justify-center"
                  style={{ height: mapHeight }}
                >
                  <Loader />
                </div>
              )}

              {/* "Preparing your order" badge — shown while no delivery boy
                  is assigned yet, mirroring the rider badge below. Top-right,
                  not top-left: the map library's zoom controls live there. */}
              {!isDeliveryBoyAssigned && (
                <div className="absolute right-3 top-3 z-[900] flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 shadow-md backdrop-blur dark:bg-zinc-900/95">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full primaryBackColor opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full primaryBackColor" />
                  </span>
                  <span className="text-xs font-semibold textColor">
                    {t("preparing_your_order") || "Preparing your order"}
                  </span>
                </div>
              )}

              {/* "Rider on the way" live badge over the map */}
              {!showOverlay && hasRider && (
                <div className="absolute right-3 top-3 z-[900] flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 shadow-md backdrop-blur dark:bg-zinc-900/95">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                  </span>
                  <span className="text-xs font-semibold textColor">
                    {t("rider_on_the_way") || "Rider on the way"}
                    {liveTimeToDeliver ? ` · ${liveTimeToDeliver}` : ""}
                  </span>
                </div>
              )}

              {/* Only block the map with the hard error when there's truly
                  nothing to fall back to — a store fix still gives the
                  customer a useful map (assigned-but-not-moving-yet rider,
                  or tracking endpoint hiccup), so don't hide it behind this. */}
              {showOverlay && !showStoreMarker && (
                <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-white/80 backdrop-blur-sm dark:bg-zinc-900/80">
                  <div className="mx-4 flex max-w-[280px] flex-col items-center gap-2.5 rounded-2xl bg-white px-6 py-6 text-center shadow-xl dark:bg-zinc-900">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-[#dc3545] dark:bg-red-500/15">
                      <IoLocationOutline size={26} />
                    </span>
                    <p className="text-sm font-bold text-[#dc3545]">
                      {t("unable_to_load_tracking_data")}
                    </p>
                    <p className="text-xs SecondaryTextColor">
                      {t("tracking_retry_hint") ||
                        "We'll keep checking automatically."}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
          )}

          {/* Delivery Details (left, ~70%) + Delivery Partner (right, ~30%) —
              side by side on wider screens. */}
          <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-10">
            {/* Delivery details — icon header + labeled rows. Date badge gets
                its own row below the title/subtitle, so the subtitle always
                has the full card width and never wraps. */}
            <div className="rounded-2xl border border-[var(--border-color)] p-4 sm:col-span-6">
              <div className="flex flex-col gap-3 border-b border-[var(--border-color)] pb-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg primaryLightBack primaryColor">
                    <IoLocationOutline size={19} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold textColor">
                      {t("delivery_details_title") || "Delivery Details"}
                    </h3>
                    <p className="text-xs SecondaryTextColor">
                      {t("delivery_details_hint") ||
                        "Details of your current order"}
                    </p>
                  </div>
                </div>
                {/* {order?.date && (
                  <span className="w-fit rounded-lg primaryLightBack px-2.5 py-1.5 text-xs font-semibold primaryColor">
                    {formatCustomDate(order?.date)}
                  </span>
                )} */}
              </div>

              <dl className="mt-3 flex flex-col gap-3">
                {deliveryAddress && (
                  <div>
                    <dt className="text-xs SecondaryTextColor">
                      {t("deliveryAddress")}
                    </dt>
                    <dd className="mt-0.5 text-sm font-semibold textColor leading-relaxed">
                      {deliveryAddress}
                    </dd>
                  </div>
                )}
                {customerName && (
                  <div>
                    <dt className="text-xs SecondaryTextColor">{t("name")}</dt>
                    <dd className="mt-0.5 text-sm font-semibold textColor">
                      {customerName}
                    </dd>
                  </div>
                )}
                {deliveryMobile && (
                  <div>
                    <dt className="text-xs SecondaryTextColor">
                      {t("mobileNumber") || t("phone")}
                    </dt>
                    <dd className="mt-0.5 text-sm font-semibold textColor">
                      {deliveryMobile}
                    </dd>
                  </div>
                )}
                {order?.payment_method && (
                  <div>
                    <dt className="text-xs SecondaryTextColor">
                      {t("payment_method")}
                    </dt>
                    <dd className="mt-0.5 text-sm font-semibold textColor capitalize">
                      {order?.payment_method}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Delivery partner — centered avatar (real photo from the chat
                conversation API when available, else an initial circle),
                call/chat actions once assigned. */}
            {order?.delivery_boy_name ? (
              <div className="flex min-w-0 flex-col items-center rounded-2xl border border-[var(--border-color)] p-4 text-center sm:col-span-4">
                <h3 className="w-full truncate text-start text-sm font-bold textColor">
                  {t("delivery_partner_title") || "Delivery Partner"}
                </h3> 
                {riderAvatar ? (
                  <span className="relative mt-3 h-14 w-14 shrink-0 overflow-hidden rounded-full primaryLightBack">
                    <Image
                      src={riderAvatar}
                      alt={order?.delivery_boy_name}
                      fill
                      className="object-cover"
                    />
                  </span>
                ) : (
                  <span className="mt-3 flex h-14 w-14 shrink-0 items-center justify-center rounded-full primaryLightBack primaryColor text-lg font-bold uppercase">
                    {order?.delivery_boy_name?.charAt(0) || "?"}
                  </span>
                )}
                <p className="mt-2 w-full truncate text-sm font-bold textColor leading-snug">
                  {order?.delivery_boy_name}
                </p>
                <div className="mt-3 flex w-full min-w-0 items-stretch gap-2">
                  {order?.delivery_boy_mobile && (
                    <Link
                      href={`tel:${order?.delivery_boy_mobile}`}
                      className="flex h-10 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg border primaryColorBorder primaryColor px-2 text-sm font-semibold transition hover:primaryBackColor hover:text-white active:scale-95"
                    >
                      <BiPhoneCall size={15} className="shrink-0" />
                      {t("call") || "Call"}
                    </Link>
                  )}
                  {order?.is_delivery_boy_chat_visible === true && (
                    <div className="min-w-0 flex-1 [&>button]:h-10 [&>button]:w-full [&>button]:rounded-lg [&>button]:px-2">
                      <DeliveryChat
                        orderId={order?.order_id ?? order?.id}
                        orderItemId={order?.id}
                        orderStatus={order?.active_status}
                        deliveryBoy={{
                          id: order?.delivery_boy_id,
                          name: order?.delivery_boy_name,
                          phone: order?.delivery_boy_mobile,
                        }}
                        variant="solid"
                        label={t("chat") || "Chat"}
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-[var(--border-color)] p-4 sm:col-span-4">
                <div className="flex items-center gap-3 border-b border-[var(--border-color)] pb-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg primaryLightBack primaryColor">
                    <LuBike size={18} />
                  </span>
                  <div className="min-w-0 flex-grow">
                    <h3 className="text-sm font-bold textColor">
                      {t("delivery_partner_title") || "Delivery Partner"}
                    </h3>
                    <p className="text-xs SecondaryTextColor">
                      {t("preparing_your_order") || "Preparing your order"}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm SecondaryTextColor">
                  {t("delivery_partner_assign_hint") ||
                    "A delivery partner will be assigned soon."}
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LiveTrackingModal;
