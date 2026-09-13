"use client";

import { t } from "@/utils/translation";
import useSupportChat from "@/hooks/useSupportChat";
import { MessageList, ChatInput } from "@/components/chat/shared/ChatPrimitives";

const Avatar = ({ name }) => (
  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-semibold shrink-0">
    {(name || "?").trim().charAt(0).toUpperCase()}
  </div>
);

/**
 * Customer ↔ Admin support — a single, always-on conversation. No chat list:
 * there is only ever one support thread per customer.
 */
export default function SupportChat() {
  const { conversation, messages, loading, sending, sendMessage } =
    useSupportChat();

  const title = conversation?.subject || t("support") || "Support";

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] min-h-[520px] border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
      {/* Header */}
      <header className="flex items-center gap-3 px-4 py-3 primaryBackColor text-white shadow-sm">
        <Avatar name={title} />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{title}</p>
        </div>
      </header>

      {/* Messages */}
      <MessageList
        messages={messages}
        typing={false}
        empty={
          loading
            ? t("loading") || "Loading…"
            : t("start_support_conversation") ||
              "Start the conversation with our support team."
        }
      />

      {/* Composer */}
      <ChatInput
        onSend={sendMessage}
        disabled={loading || sending}
        placeholder={t("type_a_message") || "Type a message…"}
      />
    </div>
  );
}
