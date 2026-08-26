"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  LuCamera,
  LuDownload,
  LuFileText,
  LuImage,
  LuMic,
  LuPause,
  LuPaperclip,
  LuPlay,
  LuPlus,
  LuSend,
  LuCircleStop,
  LuTrash2,
  LuX,
  LuCheck,
} from "react-icons/lu";
import Lightbox from "yet-another-react-lightbox";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";
import { cn } from "@/lib/utils";

// Classify an attachment URL/filename by extension so the bubble + composer
// render the right element (image / video / audio).
const IMAGE_EXT = new Set(["jpeg", "png", "jpg", "gif", "webp"]);
// Audio-only containers. Shared/ambiguous containers (mp4/webm/mpeg/3gp) are
// intentionally NOT here and NOT in VIDEO_EXT — they're resolved by mime first,
// then fall through to audio (voice notes dominate chat over real video).
const AUDIO_EXT = new Set([
  "mp3",
  "wav",
  "ogg",
  "oga",
  "m4a",
  "aac",
  "mpga",
  "amr",
  "caf",
]);
// Video-only containers (a bare URL with one of these is definitely video).
const VIDEO_EXT = new Set(["mov", "mkv", "avi", "m4v", "mpg"]);
// Containers that can be either; without a mime hint we treat them as audio
// because chat attachments here are overwhelmingly voice notes.
const AMBIGUOUS_EXT = new Set(["mp4", "webm", "mpeg", "3gp"]);

// Accept string for the <input type="file"> + a quick mime/ext-based kind check.
// Allow documents too so pdf/doc attachments reach the composer.
export const CHAT_ACCEPT =
  "image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip";

// Human-readable label for a file's extension (used in the document chip).
const docLabel = (src, name) => {
  const ext = extOf(name || src);
  return ext ? ext.toUpperCase() : "FILE";
};

// Last path segment of a URL → fallback display name for a remote document.
const baseName = (src) => {
  if (!src) return "";
  const clean = String(src).split(/[?#]/)[0];
  return decodeURIComponent(clean.substring(clean.lastIndexOf("/") + 1));
};

const extOf = (s) => {
  if (!s) return "";
  // Strip query/hash, take last path segment, take after final dot.
  const clean = String(s).split(/[?#]/)[0];
  const name = clean.substring(clean.lastIndexOf("/") + 1);
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : "";
};

// Prefer the File's mime type when available (object URLs have no extension),
// fall back to the extension of a remote URL.
export const kindOf = (src, mime) => {
  if (mime?.startsWith("image/")) return "image";
  if (mime?.startsWith("video/")) return "video";
  if (mime?.startsWith("audio/")) return "audio";
  const ext = extOf(src);
  if (VIDEO_EXT.has(ext)) return "video";
  if (AUDIO_EXT.has(ext)) return "audio";
  // Ambiguous container with no mime hint → audio (voice notes dominate chat).
  if (AMBIGUOUS_EXT.has(ext)) return "audio";
  if (IMAGE_EXT.has(ext)) return "image";
  // Unknown → treat as a downloadable document (pdf/doc/etc), not an image.
  return "file";
};

const timeOf = (iso, fallbackTime) => {
  let d;
  if (iso) {
    let str = String(iso).trim().replace(" ", "T");
    if (
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(str) &&
      !/(?:[Zz])|(?:[+-]\d{2}:?\d{2}$)/.test(str)
    ) {
      str += "Z";
    }
    d = new Date(str);
  }
  if (!d || Number.isNaN(d.getTime())) {
    if (fallbackTime) return fallbackTime;
    d = new Date();
  }
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
};

// ── Audio player (play button + thin progress bar + time) ──────────────────
// Hidden <audio> driven by a play/pause button + a clickable progress bar.
const AudioPlayer = ({ src, mine, onReady }) => {
  const ref = useRef(null);
  const barRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [cur, setCur] = useState(0);
  const [dur, setDur] = useState(0);

  const fmt = (s) => {
    if (!Number.isFinite(s) || s < 0) s = 0;
    const m = Math.floor(s / 60);
    const sec = String(Math.floor(s % 60)).padStart(2, "0");
    return `${m}:${sec}`;
  };

  const toggle = () => {
    const el = ref.current;
    if (!el) return;
    if (el.paused) el.play();
    else el.pause();
  };

  // Click/drag anywhere on the bar to seek.
  const seekToClient = (clientX) => {
    const el = ref.current;
    const bar = barRef.current;
    if (!el || !bar || !dur) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    el.currentTime = ratio * dur;
    setCur(ratio * dur);
  };
  const onBarDown = (e) => {
    seekToClient(e.clientX);
    const move = (ev) => seekToClient(ev.clientX);
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const pct = dur ? (cur / dur) * 100 : 0;

  return (
    <div
      className={cn(
        "flex items-center gap-3 w-[16rem] max-w-full rounded-2xl px-3 py-2.5 shadow-sm ring-1",
        mine
          ? "primaryBackColor text-white ring-black/10"
          : "bg-white dark:bg-zinc-800 ring-gray-100 dark:ring-white/10",
      )}
    >
      <audio
        ref={ref}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          // Streamed m4a/webm often report Infinity until you seek past the end;
          // the seek forces the browser to compute the real duration.
          if (!Number.isFinite(el.duration)) {
            const fix = () => {
              if (Number.isFinite(el.duration)) {
                setDur(el.duration);
                el.currentTime = 0;
                el.removeEventListener("timeupdate", fix);
              }
            };
            el.addEventListener("timeupdate", fix);
            el.currentTime = 1e7;
          } else {
            setDur(el.duration || 0);
          }
          onReady?.();
        }}
        onDurationChange={(e) => {
          if (Number.isFinite(e.currentTarget.duration))
            setDur(e.currentTarget.duration);
        }}
        onTimeUpdate={(e) => setCur(e.currentTarget.currentTime)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCur(0);
        }}
        className="hidden"
      >
        {/* No captions source for user-recorded voice notes; native controls
            are never shown (custom play button + progress bar drive this). */}
        <track kind="captions" />
      </audio>
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition active:scale-95",
          mine ? "bg-white primaryColor" : "primaryBackColor text-white",
        )}
        title={playing ? "Pause" : "Play"}
      >
        {playing ? (
          <LuPause size={16} />
        ) : (
          <LuPlay size={16} className="ml-0.5" />
        )}
      </button>
      <div className="flex flex-1 items-center gap-3">
        {/* Progress bar */}
        <div
          ref={barRef}
          onPointerDown={onBarDown}
          className={cn(
            "relative h-1.5 flex-1 cursor-pointer rounded-full",
            mine ? "bg-white/30" : "bg-gray-200 dark:bg-zinc-600",
          )}
        >
          <div
            className={cn(
              "absolute inset-y-0 left-0 rounded-full",
              mine ? "bg-white" : "primaryBackColor",
            )}
            style={{ width: `${pct}%` }}
          />
          <div
            className={cn(
              "absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full shadow ring-1",
              mine ? "bg-white ring-black/10" : "primaryBackColor ring-white",
            )}
            style={{ left: `${pct}%` }}
          />
        </div>
        <span
          className={cn(
            "shrink-0 text-[8px] tabular-nums",
            mine ? "text-white/85" : "text-gray-500 dark:text-gray-400",
          )}
        >
          {fmt(cur)} / {fmt(dur)}
        </span>
      </div>
    </div>
  );
};

// ── Document chip (pdf / doc / non-media) ─────────────────────────────────
const DocChip = ({ src, name, mine }) => (
  <a
    href={src}
    target="_blank"
    rel="noopener noreferrer"
    download
    className={cn(
      "flex items-center gap-2.5 min-w-[13rem] max-w-[17rem] rounded-2xl px-3 py-2.5 shadow-sm ring-1 transition",
      mine
        ? "primaryBackColor text-white ring-black/10 hover:brightness-95"
        : "bg-white dark:bg-zinc-800 ring-gray-100 dark:ring-white/10 hover:bg-gray-50 dark:hover:bg-zinc-700",
    )}
  >
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
        mine
          ? "bg-white primaryColor"
          : "bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-gray-300",
      )}
    >
      <LuFileText size={18} />
    </span>
    <div className="flex min-w-0 flex-1 flex-col">
      <span
        className={cn(
          "truncate text-xs font-medium",
          mine ? "text-white" : "text-gray-800 dark:text-gray-100",
        )}
      >
        {name || baseName(src) || "Document"}
      </span>
      <span
        className={cn(
          "text-[10px]",
          mine ? "text-white/70" : "text-gray-500 dark:text-gray-400",
        )}
      >
        {docLabel(src, name)}
      </span>
    </div>
    <LuDownload
      size={15}
      className={cn(
        "shrink-0",
        mine ? "text-white/80" : "text-gray-500 dark:text-gray-400",
      )}
    />
  </a>
);

// ── Composer attachment preview thumbnail ─────────────────────────────────
const AttachmentThumb = ({ kind, url, name }) => {
  if (kind === "video") {
    return (
      <video
        src={url}
        className="rounded-xl object-cover h-20 w-20 bg-black ring-1 ring-gray-200 dark:ring-white/10"
        muted
      />
    );
  }
  if (kind === "audio") {
    return (
      <div className="flex h-20 w-32 flex-col items-center justify-center rounded-xl bg-gray-100 dark:bg-zinc-800 ring-1 ring-gray-200 dark:ring-white/10 px-2">
        <span className="text-xl">🎵</span>
        <span className="mt-1 w-full truncate text-center text-[10px] text-gray-500 dark:text-gray-400">
          {name}
        </span>
      </div>
    );
  }
  if (kind === "file") {
    return (
      <div className="flex h-20 w-32 flex-col items-center justify-center rounded-xl bg-gray-100 dark:bg-zinc-800 ring-1 ring-gray-200 dark:ring-white/10 px-2">
        <LuFileText size={26} className="text-gray-500 dark:text-gray-400" />
        <span className="mt-1 w-full truncate text-center text-[10px] text-gray-500 dark:text-gray-400">
          {name}
        </span>
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={name}
      className="rounded-xl object-cover h-20 w-20 ring-1 ring-gray-200 dark:ring-white/10"
    />
  );
};

// ── Single message bubble ────────────────────────────────────────────────
// Normalise a message's attachments to [{ url, kind, name }]. Prefer the
// backend-supplied kind; fall back to extension-guessing for legacy shapes.
const attachmentsOf = (message) => {
  if (message.attachments?.length) {
    return message.attachments.map((a) => ({
      url: a.url,
      // Remote URLs are often extension-less (signed/CDN paths); the original
      // filename in `name` carries the real extension, so guess from it first.
      kind: a.kind || kindOf(a.name || a.url),
      name: a.name || "",
    }));
  }
  let urls = [];
  if (message.images?.length) urls = message.images;
  else if (message.image) urls = [message.image];
  return urls.map((url) => ({ url, kind: kindOf(url), name: "" }));
};

// Sent indicator for the customer's OWN messages: a single check.
const ReadTick = () => <LuCheck size={13} className="shrink-0 text-white/70" />;

export const MessageBubble = ({ message, mine, onImageClick, onImageLoad }) => {
  const atts = attachmentsOf(message);
  const hasText = !!message.text;
  const time = timeOf(
    message?.createdAt || message?.created_at || message?.updated_at,
    message?.time,
  );

  // Audio/file chips carry their own surface; when one is the entire message
  // (no text, no other attachments) the bubble wrapper just adds an ugly
  // double frame — render it bare so the chip IS the bubble.
  const soleChip =
    !hasText && atts.length === 1 && ["audio", "file"].includes(atts[0].kind);

  const mineSurfaceClass = mine
    ? "primaryBackColor text-white rounded-br-md"
    : "bg-white dark:bg-zinc-800 text-gray-800 dark:text-gray-100 ring-1 ring-gray-100 dark:ring-white/10 rounded-bl-md";
  const chipPaddingClass = atts.length && !hasText ? "p-1" : "px-3 py-1.5";
  // soleChip: chip carries its own surface/shadow → wrapper is bare.
  const wrapperClass = soleChip
    ? ""
    : cn(
        "rounded-2xl shadow-sm transition-shadow hover:shadow-md",
        chipPaddingClass,
        mineSurfaceClass,
      );

  return (
    <div
      className={cn("flex w-full mb-2", mine ? "justify-end" : "justify-start")}
    >
      <div className={cn("max-w-[80%] sm:max-w-[68%] text-sm", wrapperClass)}>
        {atts.length > 0 && (
          <div
            className={cn(
              "grid gap-1 overflow-hidden rounded-xl",
              hasText && "mb-1.5",
              atts.length === 1 ? "grid-cols-1" : "grid-cols-2",
            )}
          >
            {atts.map(({ url: src, kind, name }, i) => {
              if (kind === "video") {
                return (
                  <video
                    key={src}
                    src={src}
                    controls
                    onLoadedData={onImageLoad}
                    className={cn(
                      "block w-full rounded-lg bg-black object-cover",
                      atts.length === 1 ? "max-h-56" : "h-28",
                    )}
                  >
                    <track kind="captions" />
                  </video>
                );
              }
              if (kind === "audio") {
                return (
                  <div key={src} className="col-span-full">
                    <AudioPlayer src={src} mine={mine} onReady={onImageLoad} />
                  </div>
                );
              }
              if (kind === "file") {
                return (
                  <div key={src} className="col-span-full">
                    <DocChip src={src} name={name} mine={mine} />
                  </div>
                );
              }
              return (
                <button
                  key={src}
                  type="button"
                  onClick={() => onImageClick?.(src)}
                  className="block w-full cursor-pointer overflow-hidden rounded-lg"
                >
                  {/* plain img: chat attachments are arbitrary remote/blob URLs
                      not in next.config image allowlist */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`attachment-${i + 1}`}
                    onLoad={onImageLoad}
                    className={cn(
                      "object-cover w-full transition-transform duration-200 hover:scale-[1.03]",
                      atts.length === 1 ? "max-h-56" : "h-28",
                    )}
                  />
                </button>
              );
            })}
          </div>
        )}
        {/* Text + time flow inline: time tucks into the last line, with a
            spacer that reserves room so it never overlaps the text. */}
        {hasText ? (
          <p className="whitespace-pre-wrap break-words leading-relaxed">
            {message.text}
            <span
              className={cn(
                "float-right ml-2 mt-1 inline-flex items-center gap-1 text-[10px] leading-none translate-y-0.5",
                mine ? "text-white/70" : "text-gray-400 dark:text-gray-500",
              )}
            >
              {time}
              {mine && <ReadTick />}
            </span>
          </p>
        ) : (
          atts.length > 0 && (
            <span
              className={cn(
                "flex items-center justify-end gap-1 text-right text-[10px] leading-none mt-0.5 px-1 pb-0.5",
                // soleChip wrapper is transparent → keep the time readable on
                // the chat background rather than tying it to the bubble colour.
                !soleChip && mine
                  ? "text-white/70"
                  : "text-gray-400 dark:text-gray-500",
              )}
            >
              {time}
              {mine && !soleChip && <ReadTick />}
            </span>
          )
        )}
      </div>
    </div>
  );
};

// ── Typing indicator ─────────────────────────────────────────────────────
export const TypingDots = ({ label = "typing" }) => (
  <div className="flex items-center gap-2 mb-2.5">
    <div className="bg-white dark:bg-zinc-800 ring-1 ring-gray-100 dark:ring-white/10 rounded-2xl rounded-bl-md px-3 py-2.5 shadow-sm">
      <span className="flex gap-1">
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" />
      </span>
    </div>
    <span className="text-gray-400 dark:text-gray-500 text-xs">{label}…</span>
  </div>
);

// ── Auto-scrolling message list ──────────────────────────────────────────
export const MessageList = ({ messages, typing, typingLabel, empty }) => {
  const scrollRef = useRef(null);
  const didInitialScroll = useRef(false);
  const [lightboxIndex, setLightboxIndex] = useState(-1);

  const scrollToBottom = (behavior) => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior });
  };

  useEffect(() => {
    if (!messages.length) return;
    // First time messages arrive (e.g. after page reload) jump instantly to the
    // bottom; subsequent new messages animate. rAF waits for layout/paint so the
    // scrollHeight is correct.
    const behavior = didInitialScroll.current ? "smooth" : "auto";
    requestAnimationFrame(() => {
      scrollToBottom(behavior);
      didInitialScroll.current = true;
    });
  }, [messages.length, typing]);

  // Flatten every attachment across all messages so the lightbox can page
  // through them; keep a src → index map for click-to-open.
  const { slides, indexOf } = useMemo(() => {
    const srcs = [];
    (messages || []).forEach((m) => {
      // Only real images are clickable into the lightbox; skip video/audio/file.
      attachmentsOf(m).forEach((a) => a.kind === "image" && srcs.push(a.url));
    });
    const map = new Map();
    srcs.forEach((src, i) => {
      if (!map.has(src)) map.set(src, i);
    });
    return { slides: srcs.map((src) => ({ src })), indexOf: map };
  }, [messages]);

  if (!messages.length && !typing) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-gray-50 dark:bg-zinc-900 text-gray-400 dark:text-gray-500 text-sm p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-2xl">
          💬
        </div>
        <p className="max-w-[16rem]">
          {empty || "No messages yet. Say hello 👋"}
        </p>
      </div>
    );
  }
  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-3 py-4 bg-gray-50 dark:bg-zinc-900 custom-scrollbar"
    >
      {messages.map((m) => (
        <MessageBubble
          key={m.id}
          message={m}
          mine={m.senderType === "customer"}
          onImageClick={(src) => setLightboxIndex(indexOf.get(src) ?? 0)}
          onImageLoad={() => {
            // Keep pinned to bottom as attachments finish loading and grow height.
            if (!didInitialScroll.current) scrollToBottom("auto");
          }}
        />
      ))}
      {typing && <TypingDots label={typingLabel} />}

      <Lightbox
        styles={{ container: { backgroundColor: "#000000bf" } }}
        open={lightboxIndex >= 0}
        index={Math.max(0, lightboxIndex)}
        close={() => setLightboxIndex(-1)}
        slides={slides}
        plugins={[Thumbnails]}
        thumbnails={{ position: "bottom", border: 0, gap: 8, padding: 2 }}
      />
    </div>
  );
};

// ── Composer: text + image attach with preview ───────────────────────────
export const ChatInput = ({
  onSend,
  onTyping,
  disabled,
  disabledText,
  placeholder,
}) => {
  const [text, setText] = useState("");
  const [images, setImages] = useState([]); // [{ url, name, file, kind }]
  const [menuOpen, setMenuOpen] = useState(false);
  // Audio recording state: null | "recording" | "stopping".
  const [recState, setRecState] = useState(null);
  const [recSecs, setRecSecs] = useState(0);

  // Separate inputs so each can carry its own accept/capture attributes.
  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const filesRef = useRef(null);
  const menuRef = useRef(null);

  // MediaRecorder + collected chunks + interval id, kept in refs (no re-render).
  const mediaRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const addFiles = (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    // Keep the File for upload + an object URL for the local preview.
    setImages((prev) => [
      ...prev,
      ...files.map((f) => ({
        url: URL.createObjectURL(f),
        name: f.name,
        file: f,
        kind: kindOf(f.name, f.type),
      })),
    ]);
  };

  const pickFrom = (ref) => {
    setMenuOpen(false);
    ref.current?.click();
  };

  const onInputChange = (e) => {
    addFiles(e.target.files);
    e.target.value = "";
  };

  const removeImage = (idx) =>
    setImages((prev) => {
      const target = prev[idx];
      if (target?.url) URL.revokeObjectURL(target.url);
      return prev.filter((_, i) => i !== idx);
    });

  // ── Audio recording (MediaRecorder) ───────────────────────────────────────
  const startRecording = async () => {
    setMenuOpen(false);
    if (recState) return;
    if (
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      console.warn("Audio recording not supported in this browser");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (ev) =>
        ev.data?.size && chunksRef.current.push(ev.data);
      rec.onstop = () => {
        const type = rec.mimeType || "audio/webm";
        let ext = "webm";
        if (type.includes("ogg")) ext = "ogg";
        else if (type.includes("mp4")) ext = "m4a";
        const blob = new Blob(chunksRef.current, { type });
        // Stamp name with seconds; no Date.now (unavailable in some sandboxes).
        const file = new File([blob], `voice-${recSecs || 1}s.${ext}`, {
          type,
        });
        addFiles([file]);
        stream.getTracks().forEach((t) => t.stop());
        setRecState(null);
        setRecSecs(0);
        if (timerRef.current) clearInterval(timerRef.current);
      };
      mediaRef.current = rec;
      rec.start();
      setRecState("recording");
      setRecSecs(0);
      timerRef.current = setInterval(() => setRecSecs((s) => s + 1), 1000);
    } catch (e) {
      console.error("mic permission/record failed", e);
      setRecState(null);
    }
  };

  const stopRecording = () => {
    if (!mediaRef.current || recState !== "recording") return;
    setRecState("stopping");
    mediaRef.current.stop(); // → onstop builds the File
  };

  const cancelRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const rec = mediaRef.current;
    if (rec && rec.state !== "inactive") {
      rec.onstop = null; // drop the captured audio
      rec.stop();
      rec.stream?.getTracks?.().forEach((t) => t.stop());
    }
    chunksRef.current = [];
    mediaRef.current = null;
    setRecState(null);
    setRecSecs(0);
  };

  // Close the attach menu on outside click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target))
        setMenuOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  // Tidy up timer on unmount.
  useEffect(
    () => () => timerRef.current && clearInterval(timerRef.current),
    [],
  );

  const submit = (e) => {
    e?.preventDefault();
    if (disabled) return;
    if (recState) return; // finish/cancel recording before sending
    if (!text.trim() && !images.length) return;
    // Bucket by kind so each lands in its own FormData field: image→images[],
    // audio→audios[], video→videos[], anything else→files[].
    const byKind = (k) =>
      images.filter((im) => im.kind === k).map((im) => im.file);
    const known = new Set(["image", "audio", "video"]);
    const otherFiles = images
      .filter((im) => !known.has(im.kind))
      .map((im) => im.file);
    onSend?.({
      text,
      images: byKind("image"),
      audios: byKind("audio"),
      videos: byKind("video"),
      files: otherFiles,
    });
    images.forEach((im) => im.url && URL.revokeObjectURL(im.url));
    setText("");
    setImages([]);
  };

  const mmss = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const MENU_ITEMS = [
    {
      key: "camera",
      label: "Camera",
      icon: LuCamera,
      color: "bg-rose-500",
      onClick: () => pickFrom(cameraRef),
    },
    {
      key: "gallery",
      label: "Gallery",
      icon: LuImage,
      color: "bg-violet-500",
      onClick: () => pickFrom(galleryRef),
    },
    {
      key: "files",
      label: "Files",
      icon: LuPaperclip,
      color: "bg-sky-500",
      onClick: () => pickFrom(filesRef),
    },
    {
      key: "audio",
      label: "Audio",
      icon: LuMic,
      color: "bg-emerald-500",
      onClick: startRecording,
    },
  ];

  // Each item's onClick closes over a file-input ref (cameraRef/galleryRef/
  // filesRef) only to call `.current?.click()` inside the click handler itself —
  // never read during render. The lint rule's static analysis can't see that
  // distinction through this array/map, hence the disable.
  // eslint-disable-next-line react-hooks/refs
  const menuItemButtons = MENU_ITEMS.map((it) => {
    const Icon = it.icon;
    return (
      <button
        key={it.key}
        type="button"
        onClick={it.onClick}
        className="flex w-16 flex-col items-center gap-1.5 text-gray-600 dark:text-gray-300"
      >
        <span
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full text-white shadow-sm",
            it.color,
          )}
        >
          <Icon size={20} />
        </span>
        <span className="text-[11px]">{it.label}</span>
      </button>
    );
  });

  return (
    <form
      onSubmit={submit}
      className="border-t border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-900 p-2 sm:p-3"
    >
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {images.map((im, idx) => (
            <div key={im.url} className="relative inline-block">
              <AttachmentThumb kind={im.kind} url={im.url} name={im.name} />
              <button
                type="button"
                onClick={() => removeImage(idx)}
                className="absolute -top-2 -right-2 bg-gray-900 text-white rounded-full p-0.5 shadow-md hover:bg-black transition"
              >
                <LuX size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
      {/* Hidden inputs — one per source so each carries its own accept/capture. */}
      {/* Camera: accept a single image type only — pairing `capture` with a
          multi-type accept makes some mobile browsers show a source chooser
          (which then opens the gallery) instead of launching the camera. */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        hidden
        onChange={onInputChange}
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*,video/*"
        multiple
        hidden
        onChange={onInputChange}
      />
      <input
        ref={filesRef}
        type="file"
        accept={CHAT_ACCEPT}
        multiple
        hidden
        onChange={onInputChange}
      />

      {/* Recording bar replaces the composer row while capturing audio. */}
      {recState ? (
        <div className="flex items-center gap-3 px-2 py-1.5">
          <button
            type="button"
            onClick={cancelRecording}
            className="p-2.5 text-gray-400 hover:text-red-500 hover:bg-gray-100 dark:hover:bg-white/10 rounded-full transition"
            title="Cancel"
          >
            <LuTrash2 size={20} />
          </button>
          <div className="flex flex-1 items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <span className="inline-block h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            <span className="tabular-nums">{mmss(recSecs)}</span>
            <span className="text-gray-400">
              {recState === "stopping" ? "saving…" : "recording…"}
            </span>
          </div>
          <button
            type="button"
            onClick={stopRecording}
            disabled={recState === "stopping"}
            className="primaryBackColor text-white rounded-full p-2.5 shadow-sm enabled:hover:scale-105 enabled:active:scale-95 transition-transform disabled:opacity-40"
            title="Stop & attach"
          >
            <LuCircleStop size={20} />
          </button>
        </div>
      ) : (
        <div className="relative flex items-end gap-1.5">
          {/* Attach menu */}
          {menuOpen && (
            <div
              ref={menuRef}
              className="absolute bottom-14 left-0 z-20 grid grid-cols-4 gap-3 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-zinc-800 p-3 shadow-xl"
            >
              {menuItemButtons}
            </div>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen((o) => !o)}
            disabled={disabled}
            className={cn(
              "p-2.5 rounded-full transition disabled:opacity-40",
              menuOpen
                ? "primaryBackColor text-white"
                : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10",
            )}
            title="Attach"
          >
            <LuPlus
              size={20}
              className={cn("transition-transform", menuOpen && "rotate-45")}
            />
          </button>
          <textarea
            rows={1}
            value={text}
            disabled={disabled}
            placeholder={
              disabled
                ? disabledText || placeholder || "Type a message…"
                : placeholder || "Type a message…"
            }
            onChange={(e) => {
              setText(e.target.value);
              onTyping?.();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) submit(e);
            }}
            className="flex-1 resize-none max-h-28 rounded-3xl bg-gray-100 dark:bg-zinc-800 text-gray-800 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 border border-transparent dark:border-white/10 px-4 py-2.5 text-sm focus:outline-none focus:bg-white dark:focus:bg-zinc-800 focus:border-gray-300 dark:focus:border-white/20 transition disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={disabled || (!text.trim() && !images.length)}
            className="primaryBackColor text-white rounded-full p-2.5 shadow-sm enabled:hover:scale-105 enabled:active:scale-95 transition-transform disabled:opacity-40"
            title="Send"
          >
            <LuSend size={18} />
          </button>
        </div>
      )}
    </form>
  );
};
