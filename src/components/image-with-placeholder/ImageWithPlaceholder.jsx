"use client";
import React, { useEffect, useState } from "react";
import Image from "next/image";
import ImagePlaceholder from "../../assets/image-placeholder/image.png";
import { useSelector } from "react-redux";
import useIsHydrated from "@/hooks/useIsHydrated";

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
}) => {
  const setting = useSelector((state) => state.Setting);
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
      alt={alt}
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
