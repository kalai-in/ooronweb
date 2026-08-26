import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useSelector } from "react-redux";
import Loader from "@/components/loader/Loader";
import useZoneHref from "@/hooks/useZoneHref";

const withAuth = (WrappedComponent) => {
  const Wrapper = (props) => {
    const zoneHref = useZoneHref();
    const router = useRouter();
    const user = useSelector((state) => state.User);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [authChecked, setAuthChecked] = useState(false);

    useEffect(() => {
      const privateRoutes = [
        "/profile",
        "/checkout",
        "/profile/address",
        "/profile/activeorders",
        "/profile/orderhistory",
        "/profile/wishlist",
        "/profile/wallethistory",
        "/profile/transaction",
        "/profile/notifications",
        "/profile/subscription",
      ];
      const isPrivateRoute = privateRoutes.includes(router.pathname);

      if (isPrivateRoute && !user?.jwtToken) {
        router.push(zoneHref("/"));
      } else if (
        router.pathname === "/profile/subscription" &&
        !user?.user?.is_subscription_plans
      ) {
        router.push(zoneHref("/"));
      } else {
        setIsAuthorized(true);
      }
      setAuthChecked(true);
    }, [user, router, zoneHref]);
    if (!authChecked) {
      return <Loader screen="full" />;
    }

    return isAuthorized ? <WrappedComponent {...props} /> : null;
  };
  return Wrapper;
};

export default withAuth;
