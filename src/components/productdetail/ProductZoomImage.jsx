import React, { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";

const ZOOM = 2.2;

const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

const ProductZoomImage = ({ image, overlay, alt = "" }) => {
  const setting = useSelector((state) => state.Setting);
  const placeholder = setting?.setting?.web_settings?.placeholder_image;
  const language = useSelector((state) => state.Language.selectedLanguage);
  const isRtl = language?.type?.toLowerCase() === "rtl";

  const [imgSrc, setImgSrc] = useState(image || placeholder);
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ x: 0.5, y: 0.5 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const boxRef = useRef(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncs the displayed image with the image/placeholder props
    setImgSrc(image || placeholder);
  }, [image, placeholder]);

  const handleMove = (e) => {
    // Ignore moves over overlay controls (wishlist/share/enlarge) so the lens
    // doesn't jump toward a button the user is interacting with.
    if (e.target?.closest?.("[data-zoom-ignore]")) return;
    const rect = boxRef.current?.getBoundingClientRect();
    if (!rect) return;
    setSize({ w: rect.width, h: rect.height });
    setPos({
      x: clamp((e.clientX - rect.left) / rect.width, 0, 1),
      y: clamp((e.clientY - rect.top) / rect.height, 0, 1),
    });
  };

  // Clamp the lens centre so the lens box never leaves the image.
  const half = 1 / (2 * ZOOM); // half lens, in fraction units
  const cx = clamp(pos.x, half, 1 - half);
  const cy = clamp(pos.y, half, 1 - half);

  // Translate the scaled image so the hovered area is centred in the panel.
  const tx = -(cx * size.w * ZOOM - size.w / 2);
  const ty = -(cy * size.h * ZOOM - size.h / 2);

  return (
    <div
      ref={boxRef}
      className="relative h-full w-full"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
      onMouseMove={handleMove}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- needs onError fallback + raw pixel sizing for the zoom transform math below */}
      <img
        src={imgSrc}
        alt={alt}
        onError={() => setImgSrc(placeholder)}
        className="h-full w-full object-contain select-none [backface-visibility:hidden] [transform:translateZ(0)] [will-change:transform]"
        draggable={false}
      />

      {/* Overlay buttons (wishlist/share/enlarge) live INSIDE the hover-tracked
          box so hovering them does NOT fire the box's mouseleave → the zoom
          panel stays stable instead of flickering. */}
      {overlay}

      {/* Lens — the area being zoomed */}
      {show && (
        <div
          className="pointer-events-none absolute border border-gray-400 bg-white/30"
          style={{
            width: `${(1 / ZOOM) * 100}%`,
            height: `${(1 / ZOOM) * 100}%`,
            left: `${cx * 100}%`,
            top: `${cy * 100}%`,
            transform: "translate(-50%, -50%)",
          }}
        />
      )}

      {/* Enlarged panel — beside the image, same object-contain fit scaled ×ZOOM.
          Opens to the right in LTR, to the left in RTL so it never overlaps the
          product info column. */}
      {show && size.w > 0 && (
        <div
          dir="ltr"
          className={`pointer-events-none absolute top-0 z-[1000] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg ${
            isRtl ? "right-full mr-4" : "left-full ml-4"
          }`}
          style={{ width: size.w, height: size.h }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- needs raw pixel width/height for the zoom transform math above */}
          <img
            src={imgSrc}
            alt=""
            loading="lazy"
            decoding="async"
            className="max-w-none object-contain"
            style={{
              width: size.w * ZOOM,
              height: size.h * ZOOM,
              transform: `translate(${tx}px, ${ty}px)`,
            }}
            draggable={false}
          />
        </div>
      )}
    </div>
  );
};

export default ProductZoomImage;
