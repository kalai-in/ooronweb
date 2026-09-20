"use client";
import React, { useEffect } from "react";
import ProductsList from "@/components/productslist/ProductsList";
import { useSelector } from "react-redux";
const Productpage = ({ initialProducts = null }) => {
  const language = useSelector((state: any) => state.Language.selectedLanguage);

  useEffect(() => {}, [language?.id]);
  return <ProductsList initialProducts={initialProducts} />;
};

export default Productpage;
