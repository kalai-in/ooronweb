"use client";
import React, { useState } from "react";
import Image, { type StaticImageData } from "next/image";
import ImagePlaceholder from "../../assets/image-placeholder/image.png";
import { useSelector } from "react-redux";
import useIsHydrated from "@/hooks/useIsHydrated";

interface ImageWithPlaceholderProps {
  src?: string | StaticImageData | null;
  alt?: string;
  className?: string;
  handleOnClick?: React.MouseEventHandler<HTMLImageElement>;
  priority?: boolean;
  sizes?: string;
  quality?: number;
  width?: number;
  height?: number;
  // Not read: `fill` is decided internally from whether width/height are
  // given (see the `<Image>` spread below). Accepted here only because many
  // existing call sites pass a `fill` prop expecting that same behavior —
  // matches the original component's (identical) silent-ignore.
  fill?: boolean;
}

const ImageWithPlaceholder = ({
  src,
  alt,
  className,
  handleOnClick,
  priority,
  sizes,
  quality,
  width,
  height,
}: ImageWithPlaceholderProps) => {
  const setting = useSelector((state: any) => state.Setting);
  const [isLoading, setIsLoading] = useState(!src);
  const [isError, setIsError] = useState(false);
  // `setting` is persisted: the server has no placeholder_image and falls back to
  // the bundled asset, while the rehydrated client has the remote URL — two
  // different `src` values for the same <img>, which React rejects (#418). Until
  // hydrated, use the bundled asset so the first client render matches the server;
  // the remote placeholder lands on the second render.
  const isHydrated = useIsHydrated();
  const placeholderSrc =
    (isHydrated && setting?.setting?.web_settings?.placeholder_image) ||
    ImagePlaceholder;

  // NOTE:Change from nextjs Image to regular img to get rid of placeholder image error
  return (
    <Image
      src={!src || isLoading || isError ? placeholderSrc : src}
      alt={alt || ""}
      {...(width && height
        ? { width, height }
        : {fill: true, sizes: sizes || "100vw" })}
      quality={quality}
      priority={priority}
      className={className}
      onClick={handleOnClick}
      onLoad={() => {
        setIsLoading(false);
      }}
      onError={() => {
        setIsLoading(false);
        setIsError(true);
      }}
    />
  );
};

export default ImageWithPlaceholder;
