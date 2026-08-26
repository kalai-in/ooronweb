import React, { useCallback, useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { RiCloseFill } from "react-icons/ri";
import { t } from "@/utils/translation";
import { formatCustomDate } from "@/lib/utils";
import * as api from "@/api/apiRoutes";
import { BiPhoneCall } from "react-icons/bi";
import { IoLocationOutline } from "react-icons/io5";
import Link from "next/link";
import userIcon from "@/assets/customer_location.svg?url";
import deliveryBoyIcon from "@/assets/delivery_boy.png?url";
import MapWrapper from "@/components/maps/MapWrapper";
import Loader from "@/components/loader/Loader";

const LiveTrackingModal = ({
  showLiveTracking,
  setShowLiveTracking,
  order,
}) => {
  const [riderLocation, setRiderLocation] = useState();
  const [userLocation, setUserLocation] = useState({
    lat: null,
    lng: null,
  });
  // Road-following rider->user path from OSRM (falls back to the straight
  // line below while it's loading or if the request fails).
  const [routePath, setRoutePath] = useState(null);

  const [showOverlay, setShowOverlay] = useState(false);
  const fetchLocation = useCallback(async () => {
    try {
      const res = await api.liveOrderTracking({ orderId: order?.id });
      if (res.status == 0) {
        setShowOverlay(true);
      } else {
        const latitude = Number.parseFloat(res?.data?.latitude);
        const longitude = Number.parseFloat(res?.data?.longitude);
        setRiderLocation({ lat: latitude, lng: longitude });
        setShowOverlay(false);
      }
    } catch (error) {
      console.log("error", error);
    }
  }, [order]);

  useEffect(() => {
    if (showLiveTracking) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-open pattern; not derivable from render
      fetchLocation();
    }
  }, [showLiveTracking, fetchLocation]);

  useEffect(() => {
    let interval;
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

  // Road-following route via OSRM's public demo server (no API key). Refetches
  // whenever the rider's position moves (it comes from the 5s poll above).
  useEffect(() => {
    if (!hasRider || !hasUser) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clears stale route when rider/user coords become unavailable
      setRoutePath(null);
      return;
    }
    let active = true;
    const coords = `${riderLocation.lng},${riderLocation.lat};${userLocation.lng},${userLocation.lat}`;
    fetch(
      `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`,
    )
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        const coordinates = data?.routes?.[0]?.geometry?.coordinates;
        if (Array.isArray(coordinates) && coordinates.length > 1) {
          setRoutePath(
            coordinates.map(([lng, lat]) => ({
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
  }, [
    hasRider,
    hasUser,
    riderLocation?.lat,
    riderLocation?.lng,
    userLocation?.lat,
    userLocation?.lng,
  ]);

  // Markers + rider->user path for MapWrapper (provider-agnostic).
  const markers = [
    hasRider && {
      latitude: riderLocation.lat,
      longitude: riderLocation.lng,
      iconUrl: deliveryBoyIcon?.src,
      title: order?.delivery_boy_name,
    },
    hasUser && {
      latitude: userLocation.lat,
      longitude: userLocation.lng,
      iconUrl: userIcon?.src,
    },
  ].filter(Boolean);

  // Road-following route when available; straight line as a fallback while
  // OSRM is loading or if the request fails.
  const polyline =
    routePath ??
    (hasRider && hasUser
      ? [
          { latitude: riderLocation.lat, longitude: riderLocation.lng },
          { latitude: userLocation.lat, longitude: userLocation.lng },
        ]
      : undefined);

  // Center on the rider; fall back to user. MapWrapper needs valid coords.
  const centerLat = hasRider ? riderLocation.lat : userLocation.lat;
  const centerLng = hasRider ? riderLocation.lng : userLocation.lng;

  return (
    <Dialog open={showLiveTracking} onOpenChange={setShowLiveTracking}>
      <DialogContent
        className="w-full max-h-[90vh] flex flex-col overflow-hidden"
        title={t("livetracking")}
      >
        <DialogHeader className="shrink-0 font-bold text-2xl text-start flex flex-row justify-between">
          {t("livetracking")}
          <div className="closeButtonBg rounded-full p-[8px] gap-[4px] cursor-pointer">
            <RiCloseFill size={22} onClick={handleHideLiveTracking} />
          </div>
        </DialogHeader>
        <div className="flex flex-col gap-4 overflow-y-auto pr-1 -mr-1">
          {/* Map — rounded, bordered. Live ping badge when the rider is moving. */}
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

              {/* "Rider on the way" live badge over the map */}
              {!showOverlay && hasRider && (
                <div className="absolute left-3 top-3 z-[900] flex items-center gap-2 rounded-full bg-white/95 px-3 py-1.5 shadow-md backdrop-blur dark:bg-zinc-900/95">
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
                  </span>
                  <span className="text-xs font-semibold textColor">
                    {t("rider_on_the_way") || "Rider on the way"}
                  </span>
                </div>
              )}

              {showOverlay && (
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

          {/* 1) Delivery-partner hero */}
          {order?.delivery_boy_name && (
            <div className="flex items-center gap-3.5 rounded-2xl border border-[var(--border-color)] p-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full primaryLightBack primaryColor text-lg font-bold uppercase">
                {order?.delivery_boy_name?.charAt(0) || "?"}
              </span>
              <div className="min-w-0 flex-grow">
                <p className="text-sm sm:text-base font-bold textColor leading-snug">
                  {`${t("im") || "I'm"} ${order?.delivery_boy_name}, ${t("your_delivery_partner") || "your delivery partner"}`}
                </p>
                <p className="mt-0.5 text-xs SecondaryTextColor leading-relaxed">
                  {t("delivery_partner_hint") ||
                    "I'll reach your location soon to deliver your order."}
                </p>
              </div>
              {order?.delivery_boy_mobile && (
                <Link
                  href={`tel:${order?.delivery_boy_mobile}`}
                  aria-label={t("call") || "Call"}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border primaryColorBorder primaryColor transition hover:primaryBackColor hover:text-white active:scale-95"
                >
                  <BiPhoneCall size={20} />
                </Link>
              )}
            </div>
          )}

          {/* 2) Your delivery details — icon header + labeled rows */}
          <div className="rounded-2xl border border-[var(--border-color)] p-4">
            <div className="flex items-center gap-3 border-b border-[var(--border-color)] pb-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg primaryLightBack primaryColor">
                <IoLocationOutline size={19} />
              </span>
              <div className="min-w-0 flex-grow">
                <h3 className="text-sm font-bold textColor">
                  {t("your_delivery_details") || "Your delivery details"}
                </h3>
                <p className="text-xs SecondaryTextColor">
                  {t("delivery_details_hint") ||
                    "Details of your current order"}
                </p>
              </div>
              {order?.date && (
                <span className="shrink-0 text-xs font-semibold SecondaryTextColor">
                  {formatCustomDate(order?.date)}
                </span>
              )}
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
              </div>
            </dl>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LiveTrackingModal;
