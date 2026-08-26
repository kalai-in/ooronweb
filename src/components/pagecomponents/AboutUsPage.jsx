import React, { useEffect } from "react";
import AboutUs from "../about-us/AboutUs";
import { useSelector } from "react-redux";

const AboutUsPage = () => {

  const language = useSelector(state => state.Language.selectedLanguage)

  useEffect(() => { }, [language?.id])

  return (
    <AboutUs />
  );
};

export default AboutUsPage;
