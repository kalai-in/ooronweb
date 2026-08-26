"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { FiChevronDown, FiGlobe } from "react-icons/fi";
import * as api from "@/api/apiRoutes";

/**
 * Standalone country dropdown (flag + name + dial code). Independent of the
 * phone input — use when a form needs a separate `country_id` field.
 *
 * Props:
 *  - value: selected country id (controlled).
 *  - onChange(country): fired on select.
 *  - onReady(country): fired once when the default country resolves.
 *  - onReferralStatus(isOn): fired once with the API's root-level
 *    `is_referal_on` flag (1/0), independent of any country selection.
 *  - label: optional field label.
 */
const CountrySelect = ({
  value,
  onChange,
  onReady,
  onReferralStatus,
  label,
  hasError = false,
}) => {
  const [countries, setCountries] = useState([]);
  const [open, setOpen] = useState(false);
  // Portal position (fixed) so the list escapes any ancestor overflow-hidden
  // (e.g. the profile card) instead of being clipped.
  const [menuPos, setMenuPos] = useState(null);
  const ref = useRef(null);
  const btnRef = useRef(null);

  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const res = await api.getDialCountries();
        if (res?.status == 1 && Array.isArray(res?.data) && res.data.length) {
          setCountries(res.data);
          const envCode = process.env.NEXT_PUBLIC_DEFAULT_COUNTRY_CODE;
          const match =
            res.data.find(
              (c) => c.code === envCode || c.dial_code === envCode,
            ) || res.data[0];
          onReady?.(match);
        }
        // Root-level flag, sibling to `data` — not per-country, so it's read
        // off the raw response rather than the matched country.
        onReferralStatus?.(res?.is_referal_on == 1);
      } catch (error) {
        console.log("Error fetching countries", error);
      }
    };
    fetchCountries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Measure the trigger and place the fixed-position menu under it.
  const positionMenu = () => {
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setMenuPos({ left: r.left, top: r.bottom + 4, width: r.width });
  };

  const toggleOpen = () => {
    setOpen((v) => {
      const next = !v;
      if (next) positionMenu();
      return next;
    });
  };

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      // ref = trigger wrapper; the portalled menu carries data-country-menu so a
      // click inside it isn't treated as "outside".
      if (
        ref.current &&
        !ref.current.contains(e.target) &&
        !e.target.closest?.("[data-country-menu]")
      )
        setOpen(false);
    };
    // Reposition / close on scroll + resize so the fixed menu tracks the trigger.
    const onReflow = () => positionMenu();
    document.addEventListener("mousedown", onDown);
    window.addEventListener("scroll", onReflow, true);
    window.addEventListener("resize", onReflow);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("scroll", onReflow, true);
      window.removeEventListener("resize", onReflow);
    };
  }, [open]);

  const selected = countries.find((c) => c.id === value);

  const handleSelect = (country) => {
    onChange?.(country);
    setOpen(false);
  };

  return (
    <div className="relative w-full" ref={ref}>
      {label && (
        <label className="mb-1 block text-base font-bold">{label}</label>
      )}
      <button
        ref={btnRef}
        type="button"
        onClick={toggleOpen}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`mt-1.5 flex w-full items-center justify-between rounded-lg border py-2.5 px-4 text-sm transition-all duration-200 bg-[#f4f5f7] dark:bg-zinc-800 text-start ${
          hasError
            ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
            : "cardBorder focus:primaryColorBorder focus:ring-2 focus:ring-[var(--primary-color,#29363f)]/15"
        } textColor`}
      >
        <div className="flex items-center gap-2.5">
          {selected?.logo_url ? (
            <Image
              src={selected.logo_url}
              alt={selected.code}
              width={22}
              height={16}
              className="h-4 w-[22px] shrink-0 rounded-[2px] object-cover"
            />
          ) : (
            <FiGlobe className="text-gray-400" size={16} />
          )}
          <span className="truncate">{selected?.name || "—"}</span>
        </div>
        <FiChevronDown
          size={16}
          className={`text-gray-500 transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open &&
        menuPos &&
        typeof document !== "undefined" &&
        createPortal(
        <ul
          role="listbox"
          data-country-menu
          style={{
            position: "fixed",
            left: menuPos.left,
            top: menuPos.top,
            width: menuPos.width,
          }}
          className="z-[100] max-h-60 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
        >
          {countries.map((c) => {
            const active = value === c.id;
            return (
              <li key={c.id} role="option" aria-selected={active}>
                <button
                  type="button"
                  onClick={() => handleSelect(c)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-start text-sm transition-colors hover:primaryLightBack ${
                    active ? "primaryLightBack primaryColor font-semibold" : ""
                  }`}
                >
                  {c.logo_url && (
                    <Image
                      src={c.logo_url}
                      alt={c.code}
                      width={22}
                      height={16}
                      className="h-4 w-[22px] shrink-0 rounded-[2px] object-cover"
                    />
                  )}
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="text-gray-500">{c.dial_code}</span>
                </button>
              </li>
            );
          })}
        </ul>,
          document.body,
        )}
    </div>
  );
};

export default CountrySelect;
