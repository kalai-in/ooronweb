"use client";

import { useState } from "react";
import { LuX, LuPhone, LuChevronRight } from "react-icons/lu";
import { IoChatbubblesOutline } from "react-icons/io5";
import { TbMotorbike } from "react-icons/tb";

import { cn } from "@/lib/utils";
import { t } from "@/utils/translation";
import useIsRtl from "@/hooks/useIsRtl";
import useDeliveryChat from "@/hooks/useDeliveryChat";
import {
  MessageList,
  ChatInput,
} from "@/components/chat/shared/ChatPrimitives";

const Avatar = ({ name }) => (
  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-semibold shrink-0">
    {(name || "?").trim().charAt(0).toUpperCase()}
  </div>
);

// Launcher. `row` = Myntra-style full-width help card, `glass` = chip on
// colored banners, else a solid chip.
const Launcher = ({ variant, mode, label, subtitle, onOpen }) => {
  if (variant === "row") {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 rounded-2xl border border-[var(--border-color)] bg-white dark:bg-zinc-900 px-4 py-3.5 text-left shadow-sm"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full primaryLightBack primaryColor">
          {mode === "orderAdmin" ? (
            <IoChatbubblesOutline size={20} />
          ) : (
            <TbMotorbike size={21} />
          )}
        </span>
        <span className="min-w-0 flex-grow">
          <span className="block text-sm font-bold textColor">{label}</span>
          <span className="block text-xs SecondaryTextColor">{subtitle}</span>
        </span>
        <LuChevronRight size={20} className="shrink-0 SecondaryTextColor" />
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition",
        variant === "glass"
          ? "bg-white/15 text-white ring-1 ring-white/25 backdrop-blur-sm hover:bg-white/25"
          : "primaryBackColor text-white hover:opacity-90",
      )}
    >
      <IoChatbubblesOutline size={18} />
      {label}
    </button>
  );
};

// Closed-chat footer: read-only banner once the order is delivered, else the
// live input.
const ChatFooter = ({ closed, sendMessage, notifyTyping, available }) => {
  if (closed) {
    return (
      <div className="border-t border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-zinc-900 text-center text-xs text-gray-400 dark:text-gray-500 py-3.5">
        Order delivered. This chat is now closed.
      </div>
    );
  }
  return (
    <ChatInput
      onSend={sendMessage}
      onTyping={notifyTyping}
      disabled={!available}
      placeholder="Share a landmark or instruction…"
    />
  );
};

/**
 * Customer ↔ Delivery boy chat, scoped to one order.
 * Drop into the order detail page:
 *   <DeliveryChat orderId={order.id} orderStatus={order.active_status}
 *                 deliveryBoy={order.delivery_boy} />
 *
 * Renders nothing until a delivery boy is assigned. After delivery the chat
 * auto-closes (input disabled, banner shown) but history stays readable.
 */
export default function DeliveryChat({
  orderId,
  orderItemId,
  orderStatus,
  deliveryBoy,
  variant = "solid",
  // "delivery" (default) or "orderAdmin" (always-on order-level store chat).
  mode = "delivery",
  label,
  subtitle,
}) {
  const [open, setOpen] = useState(false);
  const rtl = useIsRtl();
  const {
    agent,
    agentTyping,
    available,
    closed,
    messages,
    sendMessage,
    notifyTyping,
  } = useDeliveryChat({ orderId, orderItemId, orderStatus, deliveryBoy, mode });
  // (deliveryBoy is forwarded to the hook so the launcher shows immediately from
  // the order's own delivery-boy details, before the conversation resolves.)

  // No assigned delivery boy yet → no chat surface at all. (Order-admin always
  // seeds an agent, so it never hits this early return.)
  if (!agent) return null;

  // Row cards use warmer titles; chip launchers keep the plain action labels.
  const rowVariant = variant === "row";
  let defaultLauncherLabel;
  if (mode === "orderAdmin") {
    defaultLauncherLabel = rowVariant
      ? t("chat_store_title") || "We're Here for You"
      : t("need_help") || "Need Help?";
  } else {
    defaultLauncherLabel = rowVariant
      ? t("chat_delivery_title") || "Stay Connected"
      : t("chat_with_delivery_partner") || "Chat with delivery partner";
  }
  const launcherLabel = label || defaultLauncherLabel;
  const launcherSubtitle =
    subtitle ||
    (mode === "orderAdmin"
      ? t("chat_store_subtitle") ||
        "Whether you have a question or need assistance, our support team is ready to help."
      : t("chat_delivery_subtitle") ||
        "Chat directly with your delivery partner for a smooth delivery experience.");
  // Slide-over's off-screen position: RTL exits left, LTR exits right.
  const hiddenTranslateClass = rtl ? "-translate-x-full" : "translate-x-full";

  return (
    <>
      <Launcher
        variant={variant}
        mode={mode}
        label={launcherLabel}
        subtitle={launcherSubtitle}
        onOpen={() => setOpen(true)}
      />

      {/* Slide-over */}
      <div
        className={cn(
          "fixed inset-0 z-50 transition",
          open ? "pointer-events-auto" : "pointer-events-none",
        )}
      >
        <button
          type="button"
          aria-label={t("close") || "Close"}
          className={cn(
            "absolute inset-0 cursor-default bg-black/40 backdrop-blur-[1px] transition-opacity duration-300",
            open ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setOpen(false)}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label={launcherLabel || "Delivery chat"}
          className={cn(
            "absolute top-0 h-full w-full sm:w-[420px] bg-white dark:bg-zinc-900 shadow-2xl flex flex-col transition-transform duration-300 ease-out",
            // RTL → panel enters from the LEFT; LTR → from the RIGHT.
            rtl ? "left-0" : "right-0",
            open ? "translate-x-0" : hiddenTranslateClass,
          )}
        >
          {/* Header */}
          <header className="primaryBackColor text-white px-4 py-3 flex items-center gap-3 shadow-sm">
            <Avatar name={agent.name} />
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{agent.name}</p>
              <p className="text-xs text-white/80 truncate">
                {closed ? "Delivered · chat closed" : `Order #${orderId}`}
              </p>
            </div>
            {agent.phone && !closed && (
              <a
                href={`tel:${agent.phone}`}
                className="p-2 rounded-full hover:bg-white/15 transition"
                title="Call"
              >
                <LuPhone size={18} />
              </a>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="p-2 rounded-full hover:bg-white/15 transition"
              title="Close"
            >
              <LuX size={20} />
            </button>
          </header>

          <MessageList
            messages={messages}
            typing={agentTyping}
            typingLabel={`${agent.name?.split(" ")[0] || "Partner"} is typing`}
            empty="Share delivery instructions or a landmark to help your partner find you."
          />

          <ChatFooter
            closed={closed}
            sendMessage={sendMessage}
            notifyTyping={notifyTyping}
            available={available}
          />
        </div>
      </div>
    </>
  );
}
