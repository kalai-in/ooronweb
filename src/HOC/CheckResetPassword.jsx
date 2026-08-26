import React, { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { useRouter } from "next/router";
import useZoneHref from "@/hooks/useZoneHref";

const CheckResetPassword = (WrappedComponent) => {
  // NB: hooks belong in the WRAPPER, not out here. The factory body runs once at
  // module evaluation — outside any component render — so calling useZoneHref()
  // at this level threw "Invalid hook call" before the page could mount.
  const ResetPasswordWrapper = (props) => {
    const zoneHref = useZoneHref();
    const router = useRouter();
    const [isAbleToReset, setIsAblseToReset] = useState(false);
    const authType = useSelector((state) => state.User.authType);
    const setting = useSelector((state) => state?.Setting?.setting);

    const passwordRoute = ["/profile/resetpassword"];
    const isPasswordRoute = passwordRoute.includes(router.pathname);

    useEffect(() => {
      if (
        isPasswordRoute &&
        !(
          authType == "email" ||
          (authType == "phone" && setting?.phone_auth_password == 1)
        )
      ) {
        router.push(zoneHref("/profile"));
      } else {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- gates render until the async-hydrated authType/setting redirect check resolves
        setIsAblseToReset(true);
      }
      // React to async-hydrated authType / settings so a phone-auth user isn't
      // wrongly redirected on a cold load before those values arrive.
    }, [authType, setting, router.pathname, isPasswordRoute, router, zoneHref]);

    return isAbleToReset ? <WrappedComponent {...props} /> : null;
  };
  return ResetPasswordWrapper;
};

export default CheckResetPassword;
