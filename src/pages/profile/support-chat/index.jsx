import React from "react";
import dynamic from "next/dynamic";
import MetaData from "@/components/metadata-component/MetaData";
const SupportChat = dynamic(
  () => import("@/components/pagecomponents/SupportChatPage"),
  {
    ssr: false,
  }
);

const index = () => {
  return (
    <div>
      <MetaData
        robots="noindex, nofollow"
        pageName="/profile/support-chat"
        title={`Support Chat - ${process.env.NEXT_PUBLIC_META_TITLE}`}
      />
      <SupportChat />
    </div>
  );
};

export default index;
