import React, { useEffect } from "react";

import ProfileDashboard from "../profiledashboard/ProfileDashboard";
import { useSelector } from "react-redux";

const WalletHistoryPage = () => {
  const language = useSelector((state) => state.Language.selectedLanguage);

  useEffect(() => {}, [language?.id]);
  return (
    <ProfileDashboard />
  );
};

export default WalletHistoryPage;
