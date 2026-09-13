"use client";

import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import {
  startOrderChat,
  startOrderAdminChat,
  getChatMessages,
  sendChatMessage,
} from "@/api/apiRoutes";
import { subscribeConversation, isChatWsEnabled, log } from "@/lib/chatWs";
import {
  mapConversation,
  mapMessage,
  mapMessages,
  type UiConversation,
  type UiMessage,
} from "@/lib/chatMappers";
import { toast } from "react-toastify";

/**
 * Customer ↔ Delivery boy chat, scoped to a single order.
 *
 * Flow:
 *   POST /chat/start_order { order_id }    → returns/creates the conversation
 *                                            (only once a delivery boy assigned)
 *   GET  /chat/messages?conversation_id=   → history
 *   POST /chat/send                        → send
 *   Pusher channel per conversation        → realtime updates
 *
 * The chat surfaces only after a delivery boy is assigned and auto-closes once
 * the order reaches a terminal status; history stays readable.
 */
interface DeliveryBoy {
  id?: number | string;
  name?: string;
  phone?: string;
}

interface ChatAgent {
  id: number | string;
  name?: string;
  phone?: string;
  online: boolean;
}

export interface UseDeliveryChatOptions {
  orderId?: number | string;
  // Ecom orders scope the conversation to a specific item line.
  orderItemId?: number | string;
  orderStatus?: number | string;
  deliveryBoy?: DeliveryBoy | null;
  // "delivery" (default) = delivery-boy chat, gated on assignment + terminal
  // status. "orderAdmin" = order-level admin/store chat: ALWAYS available for
  // any order in any status (start_order_admin).
  mode?: "delivery" | "orderAdmin";
}

export default function useDeliveryChat({
  orderId,
  // Ecom orders scope the conversation to a specific item line.
  orderItemId,
  orderStatus,
  deliveryBoy,
  // "delivery" (default) = delivery-boy chat, gated on assignment + terminal
  // status. "orderAdmin" = order-level admin/store chat: ALWAYS available for
  // any order in any status (start_order_admin).
  mode = "delivery",
}: UseDeliveryChatOptions = {}) {
  const isOrderAdmin = mode === "orderAdmin";
  const user = useSelector((s: any) => s.User?.user);
  const userId = user?.id;
  // Broadcast config comes from settings; re-open realtime once it's loaded.
  const settingStatus = useSelector((s: any) => s.Setting?.status);

  const [conversation, setConversation] = useState<UiConversation | null>(null);
  // Seed the agent from the order's own delivery-boy details when provided, so
  // the chat surface shows immediately (the conversation is created lazily on
  // first open). startOrderChat still overwrites this once it resolves.
  const seededAgent: ChatAgent | null = deliveryBoy?.id
    ? {
        id: deliveryBoy.id,
        name: deliveryBoy.name,
        phone: deliveryBoy.phone,
        online: false,
      }
    : isOrderAdmin
      ? // Order-admin chat is always available — seed a generic Store agent so the
        // launcher shows immediately for any order.
        {
          id: `order-admin-${orderId}`,
          name: deliveryBoy?.name || "Store",
          online: false,
        }
      : null;
  const [agent, setAgent] = useState<ChatAgent | null>(seededAgent);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  // Terminal states close the DELIVERY chat. Backend uses numeric active_status
  // (6=delivered, 7=cancelled, 8=returned) but accept string statuses too. The
  // order-admin chat never auto-closes — it's available in any status.
  const closed =
    !isOrderAdmin &&
    ([6, 7, 8].includes(Number(orderStatus)) ||
      (typeof orderStatus === "string" &&
        ["delivered", "completed", "returned", "cancelled"].includes(
          orderStatus.toLowerCase(),
        )));

  const conversationId = conversation?.id || null;
  // Delivery chat needs a live conversation; order-admin is always usable (the
  // conversation is created lazily on first open / send).
  const available = isOrderAdmin ? !closed : !!conversationId && !closed;

  // ── Start / fetch the order conversation ──────────────────────────────────
  const init = useCallback(async () => {
    if (!orderId) return;
    setLoading(true);
    log(`${mode}: start_order →`, orderId);
    try {
      const res = isOrderAdmin
        ? await startOrderAdminChat({ order_id: orderId })
        : await startOrderChat({
            order_id: orderId,
            order_item_id: orderItemId,
          });
      if (res?.status === 1 && res.data?.id) {
        const conv = mapConversation(res.data);
        setConversation(conv);
        if (isOrderAdmin) {
          // Admin/store conversation — title is the store/admin name.
          setAgent((prev) => ({
            id: res.data.id,
            name: res.data.title || prev?.name || "Store",
            online: false,
          }));
        } else {
          // Delivery: keep the seeded agent when the API omits the boy id.
          setAgent(
            res.data?.delivery_boy_id
              ? {
                  id: res.data.delivery_boy_id,
                  name: res.data.title,
                  online: false,
                }
              : (prev) => prev ?? seededAgent,
          );
        }
      } else {
        setConversation(null);
        setAgent((prev) => prev ?? seededAgent);
      }
    } catch (e) {
      console.error("startOrderChat failed", e);
      setConversation(null);
      setAgent((prev) => prev ?? seededAgent);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, orderItemId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- start/fetch conversation on mount/order change
    if (userId && orderId) init();
  }, [userId, orderId, init]);

  // ── Load message history ──────────────────────────────────────────────────
  const loadMessages = useCallback(
    async ({ silent }: { silent?: boolean } = {}) => {
      if (!conversationId) return;
      if (!silent) setLoading(true);
      try {
        const res = await getChatMessages({ conversation_id: conversationId });
        if (res?.status === 1) {
          const msgs = mapMessages(res.data?.messages);
          log("delivery: history loaded", msgs.length, "messages");
          setMessages(msgs);
        }
      } catch (e) {
        console.error("loadMessages failed", e);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [conversationId],
  );

  useEffect(() => {
    if (conversationId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- load history when conversation becomes available
      loadMessages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // ── Send ──────────────────────────────────────────────────────────────────
  interface SendMessageArgs {
    text?: string;
    images?: any[];
    audios?: any[];
    videos?: any[];
    files?: any[];
  }

  const sendMessage = useCallback(
    async ({ text, images, audios, videos, files }: SendMessageArgs) => {
      if (!available) return;
      const imgs = images || [];
      const auds = audios || [];
      const vids = videos || [];
      const others = files || [];
      if (
        !text?.trim() &&
        !imgs.length &&
        !auds.length &&
        !vids.length &&
        !others.length
      )
        return;
      setSending(true);
      log("delivery: send →", {
        conversationId,
        text,
        images: imgs.length,
        audios: auds.length,
        videos: vids.length,
        files: others.length,
      });
      try {
        const res = await sendChatMessage({
          conversation_id: conversationId,
          message: text?.trim() || "",
          images: imgs,
          audios: auds,
          videos: vids,
          files: others,
        });
        if (res?.status === 1) {
          const list = Array.isArray(res.data)
            ? res.data
            : res.data?.messages
              ? res.data.messages
              : res.data
                ? [res.data]
                : [];
          const created = mapMessages(list);
          log("delivery: send ✓", created.length, "created");
          setMessages((prev) => [...prev, ...created]);
        } else if (res?.message) {
          toast.error(res.message);
        }
      } catch (e: any) {
        console.error("sendMessage failed", e);
        const msg = e?.response?.data?.message || e?.message;
        if (msg) toast.error(msg);
      } finally {
        setSending(false);
      }
    },
    [available, conversationId],
  );

  // ── Realtime via WebSocket ────────────────────────────────────────────────
  useEffect(() => {
    if (!conversationId) return;
    if (!isChatWsEnabled()) {
      // No broadcast driver — fall back to REST polling.
      const poll = setInterval(() => loadMessages({ silent: true }), 12000);
      return () => clearInterval(poll);
    }
    const unsub = subscribeConversation(conversationId, (payload) => {
      // `message.sent` broadcasts the message fields at the top level, where
      // `payload.message` is the TEXT string — not a nested object. Only unwrap
      // when `.message` is an object carrying its own id (older shape).
      const raw =
        payload?.message && typeof payload.message === "object"
          ? payload.message
          : payload;
      const mapped = mapMessage(raw);
      if (!mapped) return;
      log("delivery: ws message ←", mapped);
      setMessages((prev) =>
        prev.some((m) => m.id === mapped.id) ? prev : [...prev, mapped],
      );
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, settingStatus]);

  return {
    conversationId,
    agent,
    agentOnline: !!agent?.online,
    agentTyping: false,
    available,
    closed,
    loading,
    sending,
    messages,
    sendMessage,
    // No typing endpoint in the REST spec; keep a no-op for UI compatibility.
    notifyTyping: () => {},
    refresh: loadMessages,
  };
}
