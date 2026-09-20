"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import Loader from "@/components/loader/Loader";
import useZoneHref from "@/hooks/useZoneHref";

/**
 * Consolidates the old CheckAuth.jsx (withAuth HOC) and CheckResetPassword.jsx
 * into one parameterized client guard, applied per-route instead of via a
 * central pathname allowlist — App Router's route structure already
 * determines which pages render this, so the old `privateRoutes` array (a
 * second, separately-maintained source of truth for the same set of routes)
 * is no longer needed. The security model is unchanged: still 100%
 * client-only, still reads Redux post-mount, still no server-side session
 * check — preserving the existing, documented-as-intentional posture, not
 * silently hardening it.
 *
 * - requireAuth: redirect to `redirectTo` (default "/") unless user.jwtToken.
 * - requireSubscription: also redirect unless user.user.is_subscription_plans
 *   (mirrors CheckAuth's /profile/subscription special-case).
 * - requireResetEligible: redirect to "/profile" unless authType is email, or
 *   phone with phone_auth_password enabled (mirrors CheckResetPassword).
 */
export default function AuthGate({
  children,
  requireAuth = false,
  requireSubscription = false,
  requireResetEligible = false,
  redirectTo = "/",
}: {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireSubscription?: boolean;
  requireResetEligible?: boolean;
  redirectTo?: string;
}) {
  const zoneHref = useZoneHref();
  const router = useRouter();
  const user = useSelector((state: any) => state.User);
  const authType = useSelector((state: any) => state.User.authType);
  const setting = useSelector((state: any) => state?.Setting?.setting);
  const [checked, setChecked] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (requireAuth && !user?.jwtToken) {
      router.push(zoneHref(redirectTo));
      // intentional: marks the guard's check as complete so callers stop
      // rendering the loading state, once this render's redirect decision is made.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setChecked(true);
      return;
    }
    if (requireSubscription && !user?.user?.is_subscription_plans) {
      router.push(zoneHref(redirectTo));
      setChecked(true);
      return;
    }
    if (
      requireResetEligible &&
      !(
        authType == "email" ||
        (authType == "phone" && setting?.phone_auth_password == 1)
      )
    ) {
      router.push(zoneHref("/profile"));
      setChecked(true);
      return;
    }
    setOk(true);
    setChecked(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- re-run only when the auth-relevant inputs change, matching the original HOCs' effect deps
  }, [user, authType, setting, requireAuth, requireSubscription, requireResetEligible, redirectTo]);

  // CheckAuth.jsx showed a full-screen loader while checking, then null if
  // unauthorized. CheckResetPassword.jsx showed nothing (plain null) during
  // its check — no separate loading state. Preserve both exactly rather than
  // unify them: requireResetEligible-only usage (the resetpassword route)
  // never had a loader flash, and shouldn't gain one here.
  if (!checked) {
    return requireResetEligible && !requireAuth && !requireSubscription ? null : (
      <Loader screen="full" />
    );
  }

  return ok ? <>{children}</> : null;
}
