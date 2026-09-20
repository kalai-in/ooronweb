"use client";

/**
 * Maps backend chat shapes → the shape the chat UI components expect.
 *
 * Backend conversation:
 *   { id, type:"admin_customer"|"delivery_boy_customer", order_id, user_id,
 *     delivery_boy_id, title, last_message, last_sender_type,
 *     last_message_at, last_time, unread_count }
 *
 * Backend message:
 *   { id, conversation_id, sender_type:"customer"|"admin"|"delivery",
 *     sender_id, message, attachment, attachment_url, read_at,
 *     created_at, time }
 *
 * UI conversation: { id, subject, preview, lastMessageAt, unread, status, order_id, type }
 * UI message:      { id, senderType, text, images[], createdAt, status }
 */

// "2026-06-22 14:56:41" → ISO + UTC suffix so `new Date(...)` correctly converts to local system timezone.
export const toIso = (s?: string | null): string | null => {
  if (!s) return null;
  let str = String(s).trim().replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(str) && !/[Zz]|[+-]\d{2}:?\d{2}$/.test(str)) {
    str += "Z";
  }
  return str;
};

// Raw backend shapes — unknown/loosely-defined JSON from the API, kept as `any`
// per this project's pragmatic-TS policy rather than modeled in full.
export type RawConversation = any;
export type RawMessage = any;

export interface UiConversation {
  id: any;
  subject: string;
  preview: string;
  lastMessageAt: string | null;
  lastTime: string;
  unread: number;
  status: "open";
  type: any;
  order_id: any;
  delivery_boy_id: any;
  online: boolean;
}

export const mapConversation = (c: RawConversation): UiConversation | null => {
  if (!c) return null;
  return {
    id: c.id,
    subject: c.title || "Support",
    preview: c.last_message || "",
    lastMessageAt: toIso(c.last_message_at),
    lastTime: c.last_time || "",
    unread: c.unread_count || 0,
    // Backend has no open/closed flag on conversations; treat all as open.
    status: "open",
    type: c.type,
    order_id: c.order_id,
    delivery_boy_id: c.delivery_boy_id,
    // No realtime presence in REST payload; default offline until WS says otherwise.
    online: false,
  };
};

// Backend → UI attachment kind. Trust attachment_type when present (audio /
// video / image / file); only guess from the extension as a last resort.
type AttachmentKind = "image" | "audio" | "video" | "file";
const KNOWN_KINDS: AttachmentKind[] = ["image", "audio", "video", "file"];
const kindFromType = (t: any): AttachmentKind | null =>
  KNOWN_KINDS.includes(t) ? t : null;

export interface UiAttachment {
  url: string;
  kind: AttachmentKind | null;
  name: string;
}

export interface UiMessage {
  id: any;
  senderType: any;
  text: string;
  attachments: UiAttachment[];
  images: string[];
  createdAt: string | null;
  time: string;
  status: "seen" | "sent";
}

export const mapMessage = (m: RawMessage): UiMessage | null => {
  if (!m) return null;
  // One attachment per message in the current API. Build a typed list so the UI
  // never has to re-guess the kind from the URL.
  const attachments: UiAttachment[] = m.attachment_url
    ? [
        {
          url: m.attachment_url,
          kind: kindFromType(m.attachment_type), // null → UI falls back to ext
          name: m.attachment ? m.attachment.split("/").pop() : "",
        },
      ]
    : [];
  return {
    id: m.id ?? m.message_id ?? m.chat_id,
    senderType: m.sender_type, // "customer" | "admin" | "delivery"
    text: m.message || "",
    attachments,
    // Keep images[] for the lightbox / legacy callers (URLs only).
    images: attachments.map((a) => a.url),
    createdAt: toIso(m.created_at),
    // Backend-formatted display time, e.g. "22 Jun 2026 04:19 PM".
    time: m.time || "",
    // read_at present → the recipient has seen it.
    status: m.read_at ? "seen" : "sent",
  };
};

export const mapMessages = (list?: RawMessage[] | null): UiMessage[] =>
  (list || []).map(mapMessage).filter(Boolean) as UiMessage[];
