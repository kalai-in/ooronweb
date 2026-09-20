interface MapLoaderProps {
  height?: string | number;
  className?: string;
}

/**
 * Shared loading state shown while a map provider initializes.
 */
export default function MapLoader({ height = "360px", className = "" }: MapLoaderProps) {
  const h = typeof height === "number" ? `${height}px` : height;
  return (
    <div
      className={`flex w-full items-center justify-center rounded-md bg-gray-100 dark:bg-gray-800 ${className}`}
      style={{ height: h }}
      role="status"
      aria-live="polite"
    >
      <span className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-primary" />
      <span className="sr-only">Loading map…</span>
    </div>
  );
}
