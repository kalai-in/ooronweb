import MetaData from "@/components/metadata-component/MetaData";
const Subscription = dynamic(
  () => import("@/components/pagecomponents/SubscriptionPage"),
  { ssr: false }
);
import dynamic from "next/dynamic";
import React from "react";

const index = () => {
  return (
    <div>
      <MetaData
        robots="noindex, nofollow"
        pageName="/profile/order-history"
        title={`Subscription - ${process.env.NEXT_PUBLIC_META_TITLE}`}
      />
      <Subscription />
    </div>
  );
};

export default index;
