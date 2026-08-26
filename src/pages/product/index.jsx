import { useEffect } from "react";
import { useRouter } from "next/router";
import useZoneHref from "@/hooks/useZoneHref";

/**
 * Bare /product has no listing of its own — the product listing lives at
 * /products. Redirect so /product no longer 404s.
 */
const ProductIndexRedirect = () => {
  const zoneHref = useZoneHref();
  const router = useRouter();

  useEffect(() => {
    router.replace(zoneHref("/products"));
  }, [router, zoneHref]);

  return null;
};

export default ProductIndexRedirect;
