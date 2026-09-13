"use client";

import React, { useEffect } from "react";
import ProfileDashboard from "../profiledashboard/ProfileDashboard";
import { useSelector } from "react-redux";

const WishlistPage = () => {
  const language = useSelector((state: any) => state.Language.selectedLanguage);

  useEffect(() => {}, [language?.id]);
  return (
    <ProfileDashboard />
  );
};

export default WishlistPage;
