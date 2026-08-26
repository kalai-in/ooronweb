import timeIcon from "@/assets/time_icon.svg";

/**
 * Delivery-ETA clock, drawn from src/assets/time_icon.svg.
 *
 * Painted as a CSS mask rather than an <img>: the file's fill is baked to black,
 * and these badges follow the API-driven brand colour (primaryColor) and dark
 * mode. Masking paints `currentColor` through the file's shape, so the icon
 * inherits whatever colour the caller sets while the SVG stays the single
 * source of the artwork — no copy of its path data lives here.
 *
 * Colour comes from the caller's text colour class, exactly as it did with the
 * react-icons clocks this replaces.
 */
const TimeIcon = ({ size = 9, className = "" }) => (
  <span
    aria-hidden="true"
    className={`inline-block shrink-0 bg-current ${className}`}
    style={{
      width: size,
      height: size,
      maskImage: `url(${timeIcon.src ?? timeIcon})`,
      WebkitMaskImage: `url(${timeIcon.src ?? timeIcon})`,
      maskRepeat: "no-repeat",
      WebkitMaskRepeat: "no-repeat",
      maskSize: "contain",
      WebkitMaskSize: "contain",
      maskPosition: "center",
      WebkitMaskPosition: "center",
    }}
  />
);

export default TimeIcon;
