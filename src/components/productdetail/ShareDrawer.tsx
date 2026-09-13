"use client";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { IoClose } from "react-icons/io5";
import { FaLink, FaSms } from "react-icons/fa";
import { HiOutlineDotsHorizontal } from "react-icons/hi";
import {
  WhatsappShareButton,
  WhatsappIcon,
  FacebookShareButton,
  FacebookIcon,
  FacebookMessengerShareButton,
  FacebookMessengerIcon,
  EmailShareButton,
  EmailIcon,
  LinkedinShareButton,
  LinkedinIcon,
  TelegramShareButton,
  TelegramIcon,
} from "react-share";
import { toast } from "react-toastify";
import { t } from "@/utils/translation";

interface TileProps {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
}

// Pure presentational tile — takes no closure over ShareDrawer state, so it's
// declared at module scope (not recreated every render).
const Tile = ({ children, label, onClick }: TileProps) => {
  const inner = (
    <div className="flex flex-col items-center gap-2">
      {children}
      <span className="text-xs text-gray-700">{label}</span>
    </div>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex justify-center transition-transform hover:scale-105"
      >
        {inner}
      </button>
    );
  }
  return <div className="flex justify-center">{inner}</div>;
};

interface ShareDrawerProps {
  open: boolean;
  onClose: () => void;
  url: string;
  title?: string;
  description?: string;
  image?: string;
}

/**
 * Flipkart-style share drawer: slides in from the right with a product
 * preview card and a grid of share targets.
 */
const ShareDrawer = ({ open, onClose, url, title, description, image }: ShareDrawerProps) => {
  // createPortal needs document.body, so this renders nothing on the server but
  // something on the client — a hydration mismatch that discards the whole
  // server-rendered product tree. Hold the portal back until after mount so the
  // first client render matches the server's (both empty).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    // intentional: flips mounted flag exactly once after mount so the portal
    // (needs document.body) never renders during SSR — see comment above.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  // Debug: log all share data when the drawer opens.
  useEffect(() => {
    if (!open) return;
    console.log("[ShareDrawer] share data", {
      url,
      title,
      description,
      image,
    });
  }, [open, url, title, description, image]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  const iconSize = 48;
  const iconRound = true;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(url);
    console.log("[ShareDrawer] copied link to clipboard:", url);
    toast.success(t("link_copied_to_clipboard"));
  };

  const handleMoreApps = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: description, url });
      } catch {
        /* user cancelled */
      }
    } else {
      handleCopyLink();
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[9999] ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label={t("close")}
        onClick={onClose}
        className={`absolute inset-0 bg-black/50 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Panel — bottom sheet on mobile, right drawer on lg+ */}
      <dialog
        open
        className={`absolute m-0 w-full max-w-none min-w-0 border-0 p-0 flex flex-col bg-white shadow-2xl transition-transform duration-300
          bottom-0 left-0 right-0 max-h-[85vh] rounded-t-2xl
          lg:bottom-auto lg:left-auto lg:right-0 lg:top-0 lg:h-full lg:max-h-none lg:w-full lg:max-w-md lg:rounded-none
          ${
            open
              ? "translate-y-0 lg:translate-x-0"
              : "translate-y-full lg:translate-y-0 lg:translate-x-full"
          }`}
      >
        {/* Header */}
        <div className="flex items-center gap-4 border-b border-gray-200 px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            aria-label="close"
            className="text-gray-600 dark:text-zinc-300 hover:text-black dark:hover:text-white"
          >
            <IoClose size={24} />
          </button>
          <span className="text-lg font-semibold">{t("share")}</span>
        </div>

        {/* Product preview */}
        <div className="flex items-start gap-3 border-b border-gray-200 px-5 py-4">
          {image && (
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded border border-gray-200">
              <Image
                src={image}
                alt={title || "product"}
                fill
                sizes="56px"
                className="object-contain"
              />
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-900">
              {title}
            </p>
            {description && (
              <p className="line-clamp-2 text-xs text-gray-500">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Share targets */}
        <div className="grid grid-cols-4 gap-y-6 overflow-y-auto px-5 py-6 lg:grid-cols-2">
          <Tile label={t("copyLink")} onClick={handleCopyLink}>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500 text-white">
              <FaLink size={20} />
            </span>
          </Tile>

          <Tile label="Whatsapp">
            <WhatsappShareButton url={url} title={title}>
              <WhatsappIcon size={iconSize} round={iconRound} />
            </WhatsappShareButton>
          </Tile>

          <Tile label="Facebook">
            {/* PRE-EXISTING (reported, not fixed): react-share@5's
                FacebookShareButton dropped the `quote` prop (Facebook itself
                deprecated the sharer `quote` param) — only `hashtag` remains.
                `quote` was already a no-op at runtime before this file was
                typed; cast preserves that exact (harmless) behavior rather
                than silently changing what's passed to the button. */}
            <FacebookShareButton url={url} {...({ quote: title } as any)}>
              <FacebookIcon size={iconSize} round={iconRound} />
            </FacebookShareButton>
          </Tile>

          <Tile label="Facebook messenger">
            <FacebookMessengerShareButton url={url} appId="">
              <FacebookMessengerIcon size={iconSize} round={iconRound} />
            </FacebookMessengerShareButton>
          </Tile>

          <Tile label="Email">
            <EmailShareButton url={url} subject={title} body={description}>
              <EmailIcon size={iconSize} round={iconRound} />
            </EmailShareButton>
          </Tile>

          <Tile
            label={t("sms")}
            onClick={() => {
              window.location.href = `sms:?&body=${encodeURIComponent(
                `${title} ${url}`,
              )}`;
            }}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-sky-500 text-white">
              <FaSms size={22} />
            </span>
          </Tile>

          <Tile label="LinkedIn">
            <LinkedinShareButton url={url} title={title} summary={description}>
              <LinkedinIcon size={iconSize} round={iconRound} />
            </LinkedinShareButton>
          </Tile>

          <Tile label="Telegram">
            <TelegramShareButton url={url} title={title}>
              <TelegramIcon size={iconSize} round={iconRound} />
            </TelegramShareButton>
          </Tile>

          <Tile label={t("moreApps")} onClick={handleMoreApps}>
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-300 text-gray-700">
              <HiOutlineDotsHorizontal size={24} />
            </span>
          </Tile>
        </div>
      </dialog>
    </div>,
    document.body,
  );
};

export default ShareDrawer;
