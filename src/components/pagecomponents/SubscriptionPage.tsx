"use client";

import React, { useEffect } from "react";
import ProfileDashboard from "../profiledashboard/ProfileDashboard";
import AuthGate from "@/components/auth/AuthGate";
import { useSelector } from "react-redux";

const SubscriptionPageInner = () => {
  const language = useSelector((state: any) => state.Language.selectedLanguage);

  useEffect(() => {}, [language?.id]);
  return (
    <ProfileDashboard />
  );
};

// The is_subscription_plans check (previously CheckAuth's
// pathname === "/profile/subscription" special-case) is only meaningful on
// this specific route, so it's applied here rather than inside the shared
// ProfileDashboard. ProfileDashboard's own AuthGate (requireAuth) still
// applies underneath this one — both checks run, same as the original's
// layered withAuth(ProfileDashboard) plus the pathname special-case.
const SubscriptionPage = () => (
  <AuthGate requireAuth requireSubscription>
    <SubscriptionPageInner />
  </AuthGate>
);

export default SubscriptionPage;
