import React, { useEffect } from "react";
import Home from "@/components/homepage/Home";
import { useDispatch } from "react-redux";
import { useRouter } from "next/router";
import { clearAllFilter } from "@/redux/slices/productFilterSlice";

const Homepage = ({ initialHomeLayout = null, heading = null }) => {
  const dispatch = useDispatch();
  const router = useRouter();

  useEffect(() => {
    if (router?.pathname === "/") {
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
