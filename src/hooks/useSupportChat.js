"use client";

import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import {
  startAdminChat,
  getChatMessages,
  sendChatMessage,
} from "@/api/apiRoutes";
import { subscribeConversation, isChatWsEnabled, log } from "@/lib/chatWs";
import { mapConversation, mapMessage, mapMessages } from "@/lib/chatMappers";
import { toast } from "react-toastify";

/**
 * Customer ↔ Admin support chat — production data layer.
 *
 * There is always exactly ONE admin conversation per customer. On mount we
 * resolve it via /chat/start_admin (creates it the first time, returns the same
 * one afterwards), load its history, and subscribe for realtime updates.
 *
 * REST:
 *   POST /chat/start_admin                 → the single admin conversation
 *   GET  /chat/messages?conversation_id=   → message history
 *   POST /chat/send                        → send (text + images[])
 * Realtime:
 *   Pusher channel for the conversation; new messages pushed in.
 */
export default function useSupportChat() {
  const user = useSelector((s) => s.User?.user);
  const userId = user?.id;
  // Realtime config lives in the settings response; once it arrives the effect
  // below re-runs and (if a broadcast driver is set) opens the WS subscription.
  const settingStatus = useSelector((s) => s.Setting?.status);

  const [conversation, setConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const conversationId = conversation?.id || null;

  // ── Resolve the single admin conversation + its history ───────────────────
  const init = useCallback(async () => {
    setLoading(true);
    log("support: start_admin →");
    try {
      const res = await startAdminChat();
      if (res?.status === 1 && res.data?.id) {
        const conv = mapConversation(res.data);
        log("support: conversation =", conv.id);
        setConversation(conv);
        const msgRes = await getChatMessages({ conversation_id: conv.id });
        if (msgRes?.status === 1) {
          const msgs = mapMessages(msgRes.data?.messages);
          log("support: history loaded", msgs.length, "messages");
          setMessages(msgs);
        }
      }
    } catch (e) {
      console.error("support chat init failed", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- start/fetch conversation on mount/user change
    if (userId) init();
  }, [userId, init]);

  // ── Send a message (text and/or image File objects) ───────────────────────
  const sendMessage = useCallback(
    async ({ text, images, audios, videos, files }) => {
      if (!conversationId) return;
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
      log("support: send →", {
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
          log("support: send ✓", created.length, "created");
          setMessages((prev) => [...prev, ...created]);
        } else if (res?.message) {
          toast.error(res.message);
        }
      } catch (e) {
        console.error("sendMessage failed", e);
        const msg = e?.response?.data?.message || e?.message;
        if (msg) toast.error(msg);
      } finally {
        setSending(false);
      }
    },
    [conversationId],
  );

  // ── Realtime via WebSocket ────────────────────────────────────────────────
  useEffect(() => {
    if (!conversationId) return;
    if (!isChatWsEnabled()) {
      // No broadcast driver — fall back to REST polling.
      const poll = setInterval(() => init(), 12000);
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
      log("support: ws message ←", mapped);
      setMessages((prev) =>
        prev.some((m) => m.id === mapped.id) ? prev : [...prev, mapped],
      );
    });
    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, settingStatus]);

  return {
    conversation,
    conversationId,
    messages,
    loading,
    sending,
    sendMessage,
    refresh: init,
  };
}
