  import { useEffect, useState } from "react";

  /**
   * True when the app is running as an INSTALLED PWA rather than in a browser tab.
   *
   * Two detections, because the platforms disagree:
   *   - `display-mode: standalone` — the spec'd media query, honoured by Chrome,
   *     Edge, Samsung Internet and desktop installs.
   *   - `navigator.standalone` — Safari/iOS only, and non-standard. iOS still does
   *     not implement the media query for home-screen apps, so without this the
   *     hook reports false on every iPhone install.
   *
   * Always false during SSR and on the first client paint: neither signal exists
   * on the server, so rendering off it immediately would mismatch the server HTML.
   * The value settles in the effect, one render later.
   */
  const useStandalone = () => {
    const [isStandalone, setIsStandalone] = useState(false);

    useEffect(() => {
      if (typeof window === "undefined") return;

      const query = window.matchMedia?.("(display-mode: standalone)");
      const compute = () =>
        setIsStandalone(
          // `navigator.standalone` is iOS-only and undefined elsewhere.
          query?.matches === true || window.navigator?.standalone === true,
        );

      compute();

      if (!query) return;
      // The mode can change without a reload — a desktop install switches the
      // window over in place. Safari <14 only has the deprecated addListener.
      if (query.addEventListener) {
        query.addEventListener("change", compute);
        return () => query.removeEventListener("change", compute);
      }
      query.addListener(compute);
      return () => query.removeListener(compute);
    }, []);

    return isStandalone;
  };

  export default useStandalone;
