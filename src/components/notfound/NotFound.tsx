import type { ReactNode } from "react";
import Image, { type StaticImageData } from "next/image";
import ThemedSvg from "./ThemedSvg";

// The imported asset can be an SVG (URL string or { src }) — those carry the
// baked brand accent and get recoloured to the theme — or a raster (png/webp)
// which renders as-is.
const svgUrlOf = (img: string | StaticImageData | undefined) => {
  const url = typeof img === "string" ? img : img?.src;
  return typeof url === "string" && /\.svg(\?|$)/i.test(url) ? url : null;
};

export interface NotFoundProps {
  /** imported svg/png or src string */
  image?: string | StaticImageData;
  /** main message */
  title?: string;
  /** optional sub message */
  description?: ReactNode;
  /** image max size (px) */
  size?: number;
  /** extra wrapper classes */
  className?: string;
  /** optional action (e.g. a button) */
  children?: ReactNode;
}

/**
 * Reusable empty / not-found state.
 */
const NotFound = ({
  image,
  title,
  description,
  size = 260,
  className = "",
  children,
}: NotFoundProps) => {
  return (
    <div
      className={`w-full flex flex-col items-center justify-center text-center gap-3 py-10 px-4 ${className}`}
    >
      {image &&
        (svgUrlOf(image) ? (
          <ThemedSvg
            src={svgUrlOf(image)}
            alt={title || "Not found"}
            className="w-3/4 max-w-[260px]"
          />
        ) : (
          <Image
            src={image}
            alt={title || "Not found"}
            width={size}
            height={size}
            unoptimized
            className="h-auto w-3/4 max-w-[260px]"
          />
        ))}
      {title && (
        <h2 className="text-lg md:text-xl font-bold fontColor">{title}</h2>
      )}
      {description && (
        <p className="text-sm SecondaryTextColor max-w-sm">{description}</p>
      )}
      {children}
    </div>
  );
};

export default NotFound;
