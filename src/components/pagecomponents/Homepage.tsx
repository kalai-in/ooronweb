"use client";

import React, { useEffect } from "react";
import Home from "@/components/homepage/Home";
import { useDispatch } from "react-redux";
import { usePathname } from "next/navigation";
import { clearAllFilter } from "@/redux/slices/productFilterSlice";

interface HomepageProps {
  initialHomeLayout?: any;
  heading?: string | null;
}

const Homepage = ({ initialHomeLayout = null, heading = null }: HomepageProps) => {
  const dispatch = useDispatch();
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/") {
      dispatch(clearAllFilter());
    }
    // Intentionally mount-only: clears filters once on initial home load,
    // not on every pathname change. dispatch is stable and omitted safely.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Home content is driven by the home_layout API (see HomeLayout). No shop fetch here.
  return (
    <div>
      <Home initialHomeLayout={initialHomeLayout} heading={heading} />
    </div>
  );
};

export default Homepage;
