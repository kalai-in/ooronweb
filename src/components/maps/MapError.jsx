import { MapPinOff } from "lucide-react";

/**
 * Shared, user-friendly fallback shown when a map cannot be displayed:
 * invalid/unsupported provider, missing config, or provider load failure.
 * Never throws — keeps the surrounding page intact.
 *
 * @param {{message?:string, height?:string|number, className?:string}} props
 */
export default function MapError({
  message = "Map is currently unavailable.",
  height = "360px",
  className = "",
}) {
  const h = typeof height === "number" ? `${height}px` : height;
  return (
    <div
      className={`flex w-full flex-col items-center justify-center gap-2 rounded-md bg-gray-50 px-4 text-center dark:bg-gray-800 ${className}`}
      style={{ height: h }}
      role="alert"
    >
      <MapPinOff className="h-7 w-7 text-gray-400" aria-hidden="true" />
      <p className="text-sm text-gray-500 dark:text-gray-400">{message}</p>
    </div>
  );
}
