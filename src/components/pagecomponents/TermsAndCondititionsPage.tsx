"use client";

import React, { useEffect } from "react";
import TermsAndCondititons from "../terms-and-conditions/TermsAndCondititons";
import { useSelector } from "react-redux";

const TermsAndCondititionsPage = () => {
  const language = useSelector((state: any) => state.Language.selectedLanguage);

  useEffect(() => {}, [language?.id]);
  return (
    <TermsAndCondititons />
  );
};

export default TermsAndCondititionsPage;
