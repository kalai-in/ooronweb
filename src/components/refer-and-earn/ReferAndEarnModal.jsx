import React, { useState, useMemo } from "react";
import {
  IoCopy,
  IoPersonAdd,
  IoShareSocial,
  IoCartOutline,
  IoCheckmark,
  IoGiftOutline,
  IoBagHandleOutline,
  IoShieldCheckmarkOutline,
  IoBulbOutline,
} from "react-icons/io5";
import { FaFacebook, FaXTwitter, FaWhatsapp } from "react-icons/fa6";
import { BiWallet } from "react-icons/bi";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { RiCloseFill } from "react-icons/ri";
import dynamic from "next/dynamic";
import referEarnAnimation from "@/assets/refer-earn.json";
import { t } from "@/utils/translation";
import { useSelector } from "react-redux";

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

// The gift box in refer-earn.json is baked in 3 red tones (main body/lid, the
// gradient dark stop, the bottom shadow). Recolor each to the runtime primary
// at a matching brightness so the box keeps depth but follows the theme. The
// gold ribbon + white sparkles are left as accent pops.
// Tones are matched by hue+brightness order, not exact value.
const RED_TONES = [
  { rgb: [0.988235, 0.101961, 0.25098], shade: 1 }, // main red (lid/body)
  { rgb: [0.588235, 0.058824, 0.14902], shade: 0.62 }, // gradient dark stop
  { rgb: [0.458824, 0.027451, 0.098039], shade: 0.48 }, // bottom shadow
];

const hexToRgb = (hex) => {
  if (!hex) return null;
  let h = String(hex).trim().replace(/^#/, "");
  if (/^[a-f\d]{3}$/i.test(h))
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  const m = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h);
  return m ? [1, 2, 3].map((i) => parseInt(m[i], 16) / 255) : null;
};

const near = (a, b) => Math.abs(a - b) < 0.03;
// Match an [r,g,b] against the red tone table → primary * shade, or null.
const remapRed = (r, g, b, primary) => {
  const t = RED_TONES.find(
    (x) => near(x.rgb[0], r) && near(x.rgb[1], g) && near(x.rgb[2], b),
  );
  return t ? primary.map((c) => c * t.shade) : null;
};

const recolorGift = (anim, rgb) => {
  if (!rgb) return anim;
  const clone = JSON.parse(JSON.stringify(anim));
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    // Solid fill/stroke: c.k = [r,g,b] (SVGator omits alpha).
    if (node.ty === "fl" || node.ty === "st") {
      const k = node.c?.k;
      if (Array.isArray(k) && typeof k[0] === "number") {
        const mapped = remapRed(k[0], k[1], k[2], rgb);
        if (mapped) node.c.k = [...mapped, ...(k.length > 3 ? [k[3]] : [])];
      }
    }
    // Gradient fill: g.k.k = [pos,r,g,b, pos,r,g,b, ...] — recolor each red stop.
    if (node.ty === "gf") {
      const stops = node.g?.k?.k;
      if (Array.isArray(stops)) {
        for (let i = 0; i + 3 < stops.length; i += 4) {
          const mapped = remapRed(
            stops[i + 1],
            stops[i + 2],
            stops[i + 3],
            rgb,
          );
          if (mapped) [stops[i + 1], stops[i + 2], stops[i + 3]] = mapped;
        }
      }
    }
    Object.values(node).forEach(walk);
  };
  walk(clone.assets || []);
  walk(clone.layers || []);
  return clone;
};

const ReferAndEarnModal = ({ showReferAndEarn, setShowReferAndEarn }) => {
  const user = useSelector((state) => state.User.user);
  const webSettings = useSelector(
    (state) => state.Setting?.setting?.web_settings,
  );
  // Reward amounts, currency, policies etc. come from the country_setting API,
  // fetched app-wide in Layout and stored in redux.
  const referData = useSelector((state) => state.CountrySetting.countrySetting);
  // RTL flips the step row visually, so the connector arrows must mirror too.
  const isRtl =
    useSelector(
      (state) => state.Language.selectedLanguage?.type,
    )?.toLowerCase() === "rtl";
  const [copied, setCopied] = useState(false);

  // Recolor the gift box to the runtime primary. Read settings first, fall back
  // to the CSS var (client only). Recompute only when the modal opens or color
  // changes so the JSON walk doesn't run every render.
  const giftAnimation = useMemo(() => {
    if (!showReferAndEarn) return referEarnAnimation;
    const fromSettings = webSettings?.light_mode_color || webSettings?.color;
    const hex =
      fromSettings ||
      (typeof window !== "undefined"
        ? getComputedStyle(document.documentElement).getPropertyValue(
            "--primary-color",
          )
        : null);
    return recolorGift(referEarnAnimation, hexToRgb(hex));
  }, [showReferAndEarn, webSettings]);

  const currency = referData?.currency ?? "";
  const referrerBonus = referData?.referral_credit_first_order;
  const friendBonus = referData?.referral_credit_referred;
  const minOrder = referData?.referral_min_order_amount;
  const hasReward = referrerBonus > 0 || friendBonus > 0;

  const handleCopyCode = () => {
    navigator.clipboard.writeText(user?.referral_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = (platform) => {
    const message = `${t("join_me_message")}: ${user?.referral_code}`;
    const encodedMessage = encodeURIComponent(message);

    switch (platform) {
      case "facebook":
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodedMessage}`,
          "_blank",
        );
        break;
      case "twitter":
        window.open(
          `https://twitter.com/intent/tweet?text=${encodedMessage}`,
          "_blank",
        );
        break;
      case "whatsapp":
        window.open(`https://wa.me/?text=${encodedMessage}`, "_blank");
        break;
    }
  };

  const steps = [
    {
      icon: IoShareSocial,
      title: t("share_your_code"),
      desc: t("share_your_code_desc"),
    },
    {
      icon: IoCartOutline,
      title: t("friend_places_order"),
      desc: t("friend_places_order_desc"),
    },
    {
      icon: BiWallet,
      title: t("you_earn_bonus"),
      desc: t("you_earn_bonus_desc"),
    },
  ];

  // "Both get" summary cards. Each carries its own tint so the trio reads like
  // the reference: min-order (green) · you-earn (amber) · friend-gets (blue).
  // "you" card hides when referrer bonus is 0, "friend" card hides when the
  // first-order bonus is 0. min-order always shows while any reward exists.
  const perks = [
    {
      key: "min",
      Icon: IoBagHandleOutline,
      label: t("min_order"),
      value: `${currency}${minOrder || 0}`,
      desc: t("share_message"),
      tint: "emerald",
    },
    referrerBonus > 0 && {
      key: "you",
      Icon: IoPersonAdd,
      label: t("you_get"),
      value: `${currency}${referrerBonus || 0}`,
      desc: t("you_earn_bonus_desc"),
      tint: "amber",
    },
    friendBonus > 0 && {
      key: "friend",
      Icon: IoPersonAdd,
      label: t("friend_gets"),
      value: `${currency}${friendBonus || 0}`,
      desc: t("friend_places_order_desc"),
      tint: "sky",
    },
  ].filter(Boolean);

  // Per-tint class map — kept static so Tailwind's JIT sees full class strings.
  const TINT = {
    emerald: {
      card: "bg-emerald-50 dark:bg-emerald-500/10 ring-emerald-100 dark:ring-emerald-500/20",
      icon: "bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
      value: "text-emerald-600 dark:text-emerald-400",
      label: "text-emerald-700 dark:text-emerald-300",
    },
    amber: {
      card: "bg-amber-50 dark:bg-amber-500/10 ring-amber-100 dark:ring-amber-500/20",
      icon: "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400",
      value: "text-amber-600 dark:text-amber-500",
      label: "text-amber-700 dark:text-amber-300",
    },
    sky: {
      card: "bg-sky-50 dark:bg-sky-500/10 ring-sky-100 dark:ring-sky-500/20",
      icon: "bg-sky-100 dark:bg-sky-500/20 text-sky-600 dark:text-sky-400",
      value: "text-sky-600 dark:text-sky-400",
      label: "text-sky-700 dark:text-sky-300",
    },
  };

  // `color` = brand tint for the icon well. Twitter/X uses null → falls back to
  // the theme text color so the black X mark stays legible on a dark ground too.
  const socials = [
    {
      key: "facebook",
      label: t("facebook"),
      Icon: FaFacebook,
      color: "#1877F2",
    },
    { key: "twitter", label: t("twitter"), Icon: FaXTwitter, color: null },
    {
      key: "whatsapp",
      label: t("whatsapp"),
      Icon: FaWhatsapp,
      color: "#25D366",
    },
  ];

  return (
    <Dialog open={showReferAndEarn} onOpenChange={setShowReferAndEarn}>
      <DialogContent
        className="w-full sm:w-full sm:max-w-2xl max-h-[94vh] rounded-t-[28px] sm:rounded-[28px] overflow-y-auto custom-scrollbar p-0 gap-0 border-0 shadow-2xl top-auto bottom-0 translate-y-0 sm:top-[50%] sm:bottom-auto sm:translate-y-[-50%]"
        // Header here is a bare close button — the visible "title" is artwork
        // in the hero banner, so the name has to be supplied explicitly.
        title={t("referandearn")}
      >
        {/* Close */}
        <DialogHeader className="absolute end-4 top-4 z-30 space-y-0">
          <button
            onClick={() => setShowReferAndEarn(false)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15 backdrop-blur text-white shadow-md ring-1 ring-white/20 transition hover:bg-white/25 hover:scale-105"
          >
            <RiCloseFill size={20} />
          </button>
        </DialogHeader>

        {/* ── HERO: purple gradient banner + 3D gift art ─────────────────── */}
        <div className="relative overflow-hidden px-6 pt-6 pb-14 sm:px-8 bg-gradient-to-br from-[color-mix(in_srgb,var(--primary-color)_82%,#000)] via-[var(--primary-color)] to-[color-mix(in_srgb,var(--primary-color)_65%,#000)]">
          {/* sparkle glow blobs */}
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-12 top-20 h-36 w-36 rounded-full bg-white/5 blur-3xl" />
          {/* animated illustration, pinned to the reading-end top corner (right
              in LTR, left in RTL) so it never overlaps the text block. A soft
              white radial pulse glows behind so it lifts off the hero. */}
          <div className="pointer-events-none absolute -end-1 top-1 h-40 w-40 sm:end-2 sm:top-2 sm:h-52 sm:w-52">
            {/* pulsing glow */}
            <span className="absolute inset-0 animate-pulseGlow rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.9),rgba(255,255,255,0.15)_55%,transparent_72%)] blur-md" />
            <Lottie
              animationData={giftAnimation}
              loop
              autoplay
              className="relative h-full w-full [filter:drop-shadow(0_6px_14px_rgba(0,0,0,0.25))]"
            />
          </div>

          <div className="relative max-w-[62%]">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold text-white ring-1 ring-white/20 backdrop-blur">
              <IoGiftOutline size={14} />
              {t("referandearn")}
            </span>
            <h3 className="mt-3 text-[26px] font-extrabold leading-[1.08] tracking-tight text-white">
              {t("invite_friends_and_earn_rewards")}
            </h3>
            <p className="mt-2 text-[13px] leading-relaxed text-white/80 line-clamp-2">
              {t("share_message")}
            </p>
            {/* trust pills */}
            <div className="mt-3 inline-flex flex-wrap items-center gap-x-2 gap-y-1 rounded-full bg-white/10 px-3.5 py-1.5 text-[11px] font-semibold text-white/90 ring-1 ring-white/15">
              <IoShieldCheckmarkOutline size={13} className="text-white" />
              <span>{t("secure") || "Secure"}</span>
              <span className="opacity-40">·</span>
              <span>{t("simple") || "Simple"}</span>
              <span className="opacity-40">·</span>
              <span>{t("rewarding") || "Rewarding"}</span>
            </div>
          </div>
        </div>

        {/* ── BODY: pulled up over the hero curve ────────────────────────── */}
        <div className="relative -mt-8 flex flex-col gap-4 rounded-t-[28px] bg-white dark:bg-zinc-950 px-5 pt-5 pb-5 sm:px-7">
          {/* Referral code card */}
          <div className="rounded-2xl bg-gradient-to-br from-[color-mix(in_srgb,var(--primary-color)_8%,#fff)] to-[color-mix(in_srgb,var(--primary-color)_4%,#fff)] dark:from-zinc-900 dark:to-zinc-900 p-4 ring-1 ring-[color-mix(in_srgb,var(--primary-color)_15%,transparent)] dark:ring-white/10 ">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white dark:bg-zinc-800 primaryColor shadow-sm ring-1 ring-[color-mix(in_srgb,var(--primary-color)_15%,transparent)]">
                <IoGiftOutline size={22} />
              </div>
              <div className="flex flex-col">
                <span className="text-[11px] font-bold uppercase tracking-wider primaryColor">
                  {t("your_referral_code")}
                </span>
              </div>
            </div>
            <div className="mt-3 flex flex-col sm:flex-row items-stretch gap-2.5">
              <div className="flex flex-1 items-center justify-center rounded-xl border-2 border-dashed primaryColorBorder bg-white/60 dark:bg-zinc-800/50 px-4 py-3">
                <span className="font-mono text-2xl font-black primaryColor tracking-[0.18em] truncate">
                  {user?.referral_code}
                </span>
              </div>
              <button
                onClick={handleCopyCode}
                className="flex items-center justify-center gap-2 rounded-xl primaryBackColor px-5 py-3 text-sm font-bold text-white shadow-[0_10px_25px_-6px_color-mix(in_srgb,var(--primary-color)_60%,transparent)] transition hover:opacity-95 active:scale-[0.98]"
              >
                {copied ? <IoCheckmark size={18} /> : <IoCopy size={16} />}
                <span>{copied ? t("copied") : t("copy_code")}</span>
              </button>
            </div>
            <div className="mt-2.5 flex items-center justify-center gap-1.5 text-[11px] font-medium subTextColor">
              <IoBulbOutline size={16} className="shrink-0 text-amber-500" />
              <span className="line-clamp-1">{t("share_message")}</span>
            </div>
          </div>

          {/* You & Your Friend Both Get — tinted trio */}
          {hasReward && (
            <div>
              {/* dashed lines w/ end dots + gift-badge label — a distinct
                  divider that echoes the step-connector dashes. */}
              <div className="mb-3 flex items-center gap-3">
                <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-[color-mix(in_srgb,var(--primary-color)_40%,transparent)]" />
                <span className="h-0 flex-1 border-t-[1.5px] border-dashed border-[color-mix(in_srgb,var(--primary-color)_28%,transparent)]" />
                <span className="inline-flex items-center gap-2 whitespace-nowrap">
                  <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--primary-color)_12%,transparent)] primaryColor">
                    <IoGiftOutline size={13} />
                  </span>
                  <span className="text-[13px] font-extrabold textColor tracking-tight">
                    {t("you_and_your_friend_both_get") ||
                      "You & Your Friend Both Get"}
                  </span>
                </span>
                <span className="h-0 flex-1 border-t-[1.5px] border-dashed border-[color-mix(in_srgb,var(--primary-color)_28%,transparent)]" />
                <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-[color-mix(in_srgb,var(--primary-color)_40%,transparent)]" />
              </div>
              <div
                className={`grid gap-2.5 ${
                  perks.length === 1
                    ? "grid-cols-1"
                    : perks.length === 2
                      ? "grid-cols-2"
                      : "grid-cols-3"
                }`}
              >
                {perks.map(({ key, Icon, label, value, tint }) => {
                  const c = TINT[tint];
                  return (
                    <div
                      key={key}
                      className={`flex flex-col items-center rounded-2xl px-2 py-2.5 text-center ring-1 ${c.card}`}
                    >
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full ${c.icon}`}
                      >
                        <Icon size={16} />
                      </span>
                      <span
                        className={`mt-1.5 text-[11px] font-bold ${c.label}`}
                      >
                        {label}
                      </span>
                      <span
                        className={`mt-0.5 text-base font-black ${c.value}`}
                      >
                        {value}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* How it works — horizontal step nodes with connector */}
          <div>
            {/* dashed lines w/ end dots + icon-badge label — same divider as
                "You & Your Friend Both Get". */}
            <div className="mb-3 flex items-center gap-3">
              <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-[color-mix(in_srgb,var(--primary-color)_40%,transparent)]" />
              <span className="h-0 flex-1 border-t-[1.5px] border-dashed border-[color-mix(in_srgb,var(--primary-color)_28%,transparent)]" />
              <span className="inline-flex items-center gap-2 whitespace-nowrap">
                <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--primary-color)_12%,transparent)] primaryColor">
                  <IoBulbOutline size={13} />
                </span>
                <span className="text-[13px] font-extrabold textColor tracking-tight">
                  {t("how_it_works")}
                </span>
              </span>
              <span className="h-0 flex-1 border-t-[1.5px] border-dashed border-[color-mix(in_srgb,var(--primary-color)_28%,transparent)]" />
              <span className="h-[5px] w-[5px] shrink-0 rounded-full bg-[color-mix(in_srgb,var(--primary-color)_40%,transparent)]" />
            </div>
            <div className="relative flex items-start justify-between gap-2">
              {/* Two dashed arcs bulging UP between the node pairs, the second
                  ending in an arrowhead into the last (gift) node — matches the
                  reference wave. Aspect preserved so arcs + arrow keep their
                  shape at any width. */}
              <svg
                className={`pointer-events-none absolute left-0 top-3 h-6 w-full ${
                  isRtl ? "-scale-x-100" : ""
                }`}
                viewBox="0 0 320 24"
                fill="none"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <marker
                    id="referArrow"
                    viewBox="0 0 10 10"
                    refX="4"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path
                      d="M1 1L8 5L1 9"
                      fill="none"
                      stroke="var(--primary-color)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </marker>
                </defs>
                <path
                  d="M84 11 Q107 -2 130 11"
                  stroke="color-mix(in srgb, var(--primary-color) 55%, transparent)"
                  strokeWidth="1.6"
                  strokeDasharray="4 4"
                  strokeLinecap="round"
                  markerEnd="url(#referArrow)"
                />
                <path
                  d="M190 11 Q213.5 -2 237 11"
                  stroke="color-mix(in srgb, var(--primary-color) 55%, transparent)"
                  strokeWidth="1.6"
                  strokeDasharray="4 4"
                  strokeLinecap="round"
                  markerEnd="url(#referArrow)"
                />
              </svg>
              {steps.map((step, i) => {
                const Icon = step.icon;
                return (
                  <div
                    key={i}
                    className="relative flex flex-1 flex-col items-center text-center"
                  >
                    <div className="relative z-10 flex h-11 w-11 items-center justify-center rounded-full primaryBackColor text-white shadow-lg shadow-[color-mix(in_srgb,var(--primary-color)_30%,transparent)] ring-4 ring-white dark:ring-zinc-950">
                      <Icon size={18} />
                      <span className="absolute -end-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-black primaryColor shadow ring-1 ring-black/5">
                        {i + 1}
                      </span>
                    </div>
                    <span className="mt-2 text-[11px] font-bold textColor">
                      {step.title}
                    </span>
                    <span className="mt-0.5 text-[10px] leading-snug subTextColor line-clamp-2">
                      {step.desc}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Share row — label + social buttons (doubles as the primary CTA) */}
          <div>
            <span className="mb-2 flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wider subTextColor">
              <IoShareSocial size={13} className="primaryColor" />
              {t("share_via_social_apps")}
            </span>
            <div className="grid grid-cols-3 gap-2.5">
              {socials.map(({ key, label, Icon, color }) => (
                <button
                  key={key}
                  onClick={() => handleShare(key)}
                  className="group flex items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] bg-white dark:bg-zinc-900/30 py-2.5 shadow-sm transition hover:shadow-md"
                >
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full transition group-hover:scale-110 ${
                      color
                        ? ""
                        : "textColor bg-[color-mix(in_srgb,var(--font-color)_10%,transparent)]"
                    }`}
                    style={
                      color
                        ? { backgroundColor: `${color}18`, color }
                        : undefined
                    }
                  >
                    <Icon size={16} />
                  </span>
                  <span className="text-xs font-bold subTextColor">
                    {label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ReferAndEarnModal;
