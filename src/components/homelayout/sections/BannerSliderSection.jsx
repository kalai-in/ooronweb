import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import Image from "next/image";
import { useSelector } from "react-redux";
import { useRouter } from "next/router";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { pickDeviceImage, toCssAspectRatio } from "@/utils/helperFunction";
import useZoneHref from "@/hooks/useZoneHref";
import useUrlProductFilters from "@/hooks/useUrlProductFilters";

// Per carousel_style UI presets
const STYLE_MAP = {
  full_width: {
    container: "w-full",
    align: "center",
    slideBasis: "basis-full",
    slidePad: "",
    inner: "",
    rounded: "rounded-none",
    aspect: "aspect-[1200/650]",
    spotlight: false,
  },
  card: {
    container: "",
    align: "center",
    slideBasis: "basis-full",
    slidePad: "px-2",
    inner: "p-2 md:p-3",
    rounded: "rounded-xl",
    aspect: "aspect-[1200/650]",
    spotlight: false,
  },
  peek: {
    container: "",
    align: "center",
    slideBasis: "basis-[88%] sm:basis-[82%] md:basis-[75%] lg:basis-[80%]",
    slidePad: "px-2",
    inner: "p-1",
    rounded: "rounded-2xl",
    aspect: "aspect-[1200/650]",
    spotlight: false,
  },
  spotlight: {
    container: "",
    align: "center",
    slideBasis: "basis-[88%] sm:basis-[82%] md:basis-[75%] lg:basis-[80%]",
    slidePad: "px-2",
    inner: "p-1",
    rounded: "rounded-2xl",
    aspect: "aspect-[1200/650]",
    spotlight: true,
  },
  story: {
    container: "",
    align: "center",
    slideBasis: "basis-full",
    slidePad: "",
    inner: "",
    rounded: "rounded-lg",
    aspect: "aspect-[1200/650]",
    spotlight: false,
  },
};

// `priority` is set by HomeLayout only for the first block of the first section.
// It gates the first SLIDE's promotion: this component previously promoted slide
// 0 of every slider on the page, so a slider halfway down competed with the real
// LCP element for bandwidth. Only the above-the-fold one should win.
const BannerSliderSection = ({
  block,
  borderRadius,
  device = "web",
  priority = false,
}) => {
  const zoneHref = useZoneHref();
  const { buildQueryPatch } = useUrlProductFilters();
  const router = useRouter();
  const language = useSelector((state) => state.Language.selectedLanguage);

  const config = block?.config || {};
  const items = (block?.items || []).filter((item) =>
    pickDeviceImage(item?.images, device, item?.image_url),
  );
  const itemCount = items.length;

  const S = STYLE_MAP[config?.carousel_style] || STYLE_MAP.card;
  const isStory = config?.carousel_style === "story";

  // Story uses a manual timer (WhatsApp sequential), others use embla Autoplay.
  // Skipped entirely for a single banner — there is no second slide to advance
  // to, so the timer would just tick against itself.
  const plugins = useMemo(
    () =>
      config?.auto_scroll && !isStory && itemCount > 1
        ? [
            Autoplay({
              delay: config?.speed_ms || 3000,
              stopOnInteraction: false,
              stopOnMouseEnter: false,
              stopOnFocusIn: false,
            }),
          ]
        : [],
    [config?.auto_scroll, config?.speed_ms, isStory, itemCount],
  );

  // peek/spotlight center every slide so neighbors peek on BOTH sides (incl. first/last)
  const symmetricPeek = S.spotlight || config?.carousel_style === "peek";

  // Stable options — a fresh object each render makes embla-react reinit and resets autoplay
  const emblaOptions = useMemo(
    () => ({
      loop: config?.infinite_loop && itemCount > 1,
      align: S.align,
      containScroll: symmetricPeek ? "" : "trimSnaps",
      direction: language?.type === "RTL" ? "rtl" : "ltr",
      // A single banner has nowhere to go: dragging it just rubber-bands the
      // slide and back, which reads as a broken carousel. Disable the gesture
      // entirely so it behaves like the static image it is.
      watchDrag: itemCount > 1,
    }),
    [config?.infinite_loop, itemCount, S.align, symmetricPeek, language?.type],
  );

  const [emblaRef, emblaApi] = useEmblaCarousel(emblaOptions, plugins);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState([]);
  const [isVisible, setIsVisible] = useState(true);

  // Story progress is written straight to the active bar's DOM node — NOT React state.
  // A 60fps setState here re-renders the whole banner every frame (jank during scroll).
  const fillRefs = useRef([]);
  const setProgressWidth = useCallback((index, pct) => {
    const node = fillRefs.current[index];
    if (node) node.style.width = `${pct}%`;
  }, []);

  const autoScroll = !!config?.auto_scroll;
  const infiniteLoop = !!config?.infinite_loop;
  const speedMs = config?.speed_ms || 3000;
  // Shape comes from the API's `image_aspect` ("3:1"). 3/1 is the default when
  // it's missing or malformed — the old `image_height: 320` default at a typical
  // desktop banner width.
  const aspectRatio = toCssAspectRatio(config?.image_aspect) ?? "3 / 1";

  const viewportRef = useRef(null);
  // Single animation controller refs (prevents multiple timers running at once)
  const rafRef = useRef(null);
  const startTimeRef = useRef(null); // baseline timestamp for the active run
  const elapsedRef = useRef(0); // ms elapsed on active story; preserved across pause/resume
  const frozenRef = useRef(false); // true when parked on last story (no loop); avoids re-render spam
  const indexRef = useRef(0); // current story index, readable inside the RAF loop

  // Story auto-advance. Returns true if it advanced, false if parked (last + no loop).
  // Computes the next index explicitly and sets it optimistically so the indicators update
  // even if embla's "select" event is delayed/not emitted for this config.
  const advanceStory = useCallback(() => {
    const last = itemCount - 1;
    const cur = indexRef.current;
    let next;
    if (cur < last) next = cur + 1;
    else if (infiniteLoop) next = 0;
    else return false; // last story, no loop -> park
    indexRef.current = next;
    setSelectedIndex(next);
    if (emblaApi) emblaApi.scrollTo(next);
    return true;
  }, [emblaApi, infiniteLoop, itemCount]);

  // Reset progress when the active story changes (manual nav). The continuous RAF loop
  // below sees startTimeRef === null on its next frame and rebaselines for the new story.
  // Zero every bar directly (no state) so only the active one fills via RAF.
  useEffect(() => {
    elapsedRef.current = 0;
    startTimeRef.current = null;
    fillRefs.current.forEach((node) => {
      if (node) node.style.width = "0%";
    });
  }, [selectedIndex]);

  // Pause when the carousel scrolls off-screen, resume from current progress
  useEffect(() => {
    const node = viewportRef.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.5 },
    );
    observer.observe(node);
    const onTabVisibility = () => setIsVisible(!document.hidden);
    document.addEventListener("visibilitychange", onTabVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onTabVisibility);
    };
  }, []);

  // Single CONTINUOUS requestAnimationFrame controller. NOT recreated per story — it advances
  // and rebaselines itself, so every story restarts its own progress fill (0 -> 100 over speed_ms).
  // Paused (resumable from current progress) when not visible. No-op when auto_scroll is off.
  useEffect(() => {
    // itemCount > 1, not >= 1: with a single story there is nothing to advance
    // to, and the loop would otherwise run at 60fps forever just to fill one
    // progress bar and park.
    if (!isStory || !autoScroll || itemCount < 2 || !isVisible) return;

    let stopped = false;
    startTimeRef.current = null; // rebaseline from preserved elapsed on (re)start / resume
    const tick = (now) => {
      if (stopped) return;
      if (startTimeRef.current == null) {
        startTimeRef.current = now - elapsedRef.current; // (re)start / resume / manual-nav reset
        frozenRef.current = false;
      }
      const elapsed = now - startTimeRef.current;

      if (elapsed >= speedMs) {
        if (advanceStory()) {
          // rebaseline immediately for the next story (don't wait on embla's select event)
          elapsedRef.current = 0;
          startTimeRef.current = now;
          // indexRef already advanced inside advanceStory(); fill its new bar from 0
          setProgressWidth(indexRef.current, 0);
        } else if (!frozenRef.current) {
          // last story, no loop -> park at full; resume if manual nav nulls startTimeRef
          frozenRef.current = true;
          elapsedRef.current = speedMs;
          setProgressWidth(indexRef.current, 100);
        }
      } else {
        elapsedRef.current = elapsed;
        setProgressWidth(indexRef.current, (elapsed / speedMs) * 100);
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [
    isStory,
    autoScroll,
    itemCount,
    isVisible,
    speedMs,
    infiniteLoop,
    emblaApi,
    advanceStory,
    setProgressWidth,
  ]);

  const scrollTo = useCallback(
    (index) => emblaApi && emblaApi.scrollTo(index),
    [emblaApi],
  );
  const scrollPrev = useCallback(
    () => emblaApi && emblaApi.scrollPrev(),
    [emblaApi],
  );
  const scrollNext = useCallback(() => {
    if (!emblaApi) return;
    if (emblaApi.canScrollNext()) emblaApi.scrollNext();
    else if (infiniteLoop) emblaApi.scrollTo(0);
  }, [emblaApi, infiniteLoop]);
  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    const idx = emblaApi.selectedScrollSnap();
    indexRef.current = idx;
    setSelectedIndex(idx);
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    setScrollSnaps(emblaApi.scrollSnapList());
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  const hasRedirect = (item) =>
    (item?.redirect_type === "url" && item?.redirect_url) ||
    ((item?.redirect_type === "product" ||
      item?.redirect_type === "category") &&
      item?.redirect_id);

  const handleClick = (item) => {
    if (item?.redirect_type === "url" && item?.redirect_url) {
      window.open(item.redirect_url, "_blank");
    } else if (item?.redirect_type === "product" && item?.redirect_id) {
      router.push(zoneHref(`/product/${item.redirect_id}`));
    } else if (item?.redirect_type === "category" && item?.redirect_id) {
      router.push({
        pathname: zoneHref("/products"),
        query: buildQueryPatch({ category_id: item.redirect_id.toString() }),
      });
    }
  };

  if (itemCount === 0) return null;

  return (
    <section>
      <div className={S.container} ref={viewportRef}>
        <div className="relative">
          {/* embla viewport — overlays live OUTSIDE it so embla's drag handling
              doesn't swallow indicator / tap-zone clicks */}
          <div className="overflow-hidden" ref={emblaRef}>
            <div className="flex">
              {items.map((item, index) => {
                const src = pickDeviceImage(
                  item?.images,
                  device,
                  item?.image_url,
                );
                const dimmed = S.spotlight && index !== selectedIndex;
                return (
                  <div
                    className={`relative flex-shrink-0 min-w-0 ${S.slideBasis} ${S.slidePad}`}
                    key={index}
                  >
                    <div
                      className={`transition-all duration-300 ease-out ${
                        hasRedirect(item) ? "cursor-pointer" : "cursor-default"
                      } ${S.inner} ${
                        dimmed ? "scale-90 opacity-50" : "scale-100 opacity-100"
                      }`}
                      onClick={() => handleClick(item)}
                    >
                      {/* Box shaped by the API's image_aspect -> equal heights across slides,
                        and the height scales with the viewport instead of being pinned to a
                        pixel value. Image fills via object-cover: full width, no SIDE crop;
                        only top/bottom crops. API border_radius overrides the preset rounded. */}
                      <div
                        className={`relative w-full overflow-hidden ${borderRadius == null ? S.rounded : ""}`}
                        style={{
                          aspectRatio,
                          ...(borderRadius == null ? {} : { borderRadius }),
                        }}
                      >
                        <Image
                          src={src}
                          alt="Banner image"
                          priority={priority && index === 0}
                          className={`absolute inset-0 w-full h-full object-cover ${borderRadius == null ? S.rounded : ""}`}
                          style={
                            borderRadius == null ? undefined : { borderRadius }
                          }
                          width={1920}
                          height={1040}
                          sizes="(max-width: 768px) 100vw, 1920px"
                          quality={75}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Story tap zones: left = previous, right = next (only while auto-playing).
              z-20, below the indicators. When auto_scroll is off, the image click opens
              the banner action instead, so no tap zones are rendered. */}
          {isStory && autoScroll && itemCount > 1 && (
            <>
              <button
                type="button"
                onClick={scrollPrev}
                aria-label="Previous story"
                className="absolute left-0 top-0 z-20 h-full w-1/3 cursor-pointer focus:outline-none"
              />
              <button
                type="button"
                onClick={scrollNext}
                aria-label="Next story"
                className="absolute right-0 top-0 z-20 h-full w-2/3 cursor-pointer focus:outline-none"
              />
            </>
          )}

          {!isStory &&
            config?.indicator === "dots" &&
            scrollSnaps.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center justify-center gap-1.5 w-fit z-10">
                {scrollSnaps.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => scrollTo(index)}
                    aria-label={`Go to slide ${index + 1}`}
                    style={
                      index === selectedIndex
                        ? { backgroundColor: "#000" }
                        : undefined
                    }
                    className={`h-2 w-2 rounded-full transition-all duration-300 ease-out [box-shadow:0_1px_2px_rgba(0,0,0,0.3)] ${
                      index === selectedIndex
                        ? "scale-110"
                        : "bg-white/45 hover:bg-white/70"
                    }`}
                  />
                ))}
              </div>
            )}
        </div>

        {/* Story: full-width segmented progress bar BELOW the banner.
            Active segment fills primary color, rest stay gray. */}
        {isStory && itemCount > 0 && (
          <div className="flex items-center w-full mt-2 px-2">
            <div className="flex gap-1.5 w-full">
              {items.map((_, index) => {
                const isActive = index === selectedIndex;
                // Initial width only. While playing, the RAF loop writes width
                // straight to this node via fillRefs — no re-render per frame.
                const initialFill = isActive && !autoScroll ? 100 : 0;
                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => scrollTo(index)}
                    className="flex-1 h-4 flex items-center cursor-pointer focus:outline-none"
                    aria-label={`Go to slide ${index + 1}`}
                  >
                    <span className="block w-full h-1 rounded-full bg-gray-300/80 overflow-hidden">
                      <span
                        ref={(node) => {
                          fillRefs.current[index] = node;
                        }}
                        className="block h-full rounded-full bg-[var(--primary-color)]"
                        style={{ width: `${initialFill}%` }}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

// Memoized like every other section. This one matters most: it owns a
// continuous requestAnimationFrame loop and an embla instance, so re-rendering
// it on unrelated HomeLayout state changes is the most expensive no-op on the
// page. Props are primitives plus the `block` object, which comes straight from
// the query cache and is referentially stable between renders.
export default React.memo(BannerSliderSection);
