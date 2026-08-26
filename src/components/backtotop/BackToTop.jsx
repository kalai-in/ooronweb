import React, { useEffect, useState } from "react";
import { FaArrowUp } from "react-icons/fa";

// Floating "back to top" button. Hidden until the user scrolls past `offset`px,
// then springs in at the bottom-right. A circular SVG ring tracks scroll
// progress; the arrow bounces; hover lifts the button. Click smooth-scrolls top.
const RING_RADIUS = 20;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const BackToTop = ({ offset = 400 }) => {
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1 of page scrolled

  useEffect(() => {
    const onScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      setVisible(scrollTop > offset);
      setProgress(docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [offset]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <button
      type="button"
      aria-label="Back to top"
      onClick={scrollToTop}
      // Mobile/tablet have a fixed bottom nav (~64px + safe-area, z-50). Park the
      // button ABOVE it (bottom-[calc(...)] incl. safe-area inset) on small
      // screens so it isn't clipped/overlapped by the nav; drop back to bottom-6
      // on md+ where there's no bottom nav.
      className={`group fixed end-4 md:end-6 bottom-[calc(72px+env(safe-area-inset-bottom))] md:bottom-6 z-40 flex h-12 w-12 items-center justify-center rounded-full primaryBackColor text-white shadow-lg transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl active:scale-90 ${
        visible
          ? "translate-y-0 scale-100 opacity-100"
          : "pointer-events-none translate-y-6 scale-75 opacity-0"
      }`}
    >
      {/* Scroll-progress ring — strokeDashoffset shrinks as the page scrolls. */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
        viewBox="0 0 48 48"
        aria-hidden="true"
      >
        <circle
          cx="24"
          cy="24"
          r={RING_RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="2.5"
        />
        <circle
          cx="24"
          cy="24"
          r={RING_RADIUS}
          fill="none"
          stroke="#fff"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={RING_CIRCUMFERENCE * (1 - progress)}
          style={{ transition: "stroke-dashoffset 0.1s linear" }}
        />
      </svg>
      {/* Arrow bounces idle; nudges further up on hover. */}
      <FaArrowUp
        size={16}
        className="back-to-top-arrow transition-transform duration-300 group-hover:-translate-y-0.5"
      />
    </button>
  );
};

export default BackToTop;
