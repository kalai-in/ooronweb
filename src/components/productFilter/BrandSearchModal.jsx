import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { RiCloseFill } from "react-icons/ri";
import { t } from "@/utils/translation";

const ALPHABET = ["#", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];

const brandName = (brand) => brand?.translations?.name ?? brand?.name ?? "";

const groupKeyFor = (name) => {
  const first = name?.trim()?.[0]?.toUpperCase();
  return first && /[A-Z]/.test(first) ? first : "#";
};

const BrandSearchModal = ({
  open,
  onOpenChange,
  brands,
  selectedBrandIds,
  onToggleBrand,
}) => {
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? brands.filter((b) => brandName(b).toLowerCase().includes(q))
      : brands;

    const byLetter = {};
    filtered.forEach((brand) => {
      const key = groupKeyFor(brandName(brand));
      byLetter[key] ??= [];
      byLetter[key].push(brand);
    });
    Object.values(byLetter).forEach((list) =>
      list.sort((a, b) => brandName(a).localeCompare(brandName(b))),
    );
    return byLetter;
  }, [brands, query]);

  const availableLetters = new Set(Object.keys(groups));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-full max-h-full w-full max-w-full flex-col gap-0 overflow-hidden rounded-none p-0 sm:h-auto sm:max-h-[85vh] sm:max-w-2xl sm:rounded-lg lg:max-w-4xl"
        title={t("brands")}
      >
        <button
          type="button"
          aria-label={t("close")}
          onClick={() => onOpenChange(false)}
          className="absolute end-3 top-3 z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition"
        >
          <RiCloseFill size={20} />
        </button>
        <DialogHeader className="sr-only">{t("brands")}</DialogHeader>
        <div className="flex shrink-0 flex-col gap-3 border-b border-gray-100 dark:border-zinc-800 p-4 pe-14 sm:flex-row sm:items-start sm:gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("searchBrand")}
            className="w-full shrink-0 rounded-md border border-gray-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm outline-none focus:primaryColorBorder sm:w-60"
            autoFocus
          />

          <div className="flex flex-1 flex-wrap content-start gap-x-1 gap-y-1">
            {ALPHABET.map((letter) => {
              const has = availableLetters.has(letter);
              return (
                <a
                  key={letter}
                  href={`#brand-group-${letter}`}
                  aria-disabled={!has}
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-semibold leading-none sm:h-[18px] sm:w-[18px] ${
                    has
                      ? "textColor hover:primaryBackColor hover:text-white cursor-pointer"
                      : "text-gray-300 dark:text-zinc-700 pointer-events-none"
                  }`}
                >
                  {letter}
                </a>
              );
            })}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto custom-scrollbar p-4">
          {Object.keys(groups).length === 0 ? (
            <p className="text-sm text-gray-500 py-6 text-center">
              {t("no_data_found")}
            </p>
          ) : (
            ALPHABET.filter((letter) => groups[letter]?.length).map(
              (letter) => (
                <div key={letter} id={`brand-group-${letter}`} className="mb-5">
                  <div className="mb-2 text-sm font-bold textColor">
                    {letter}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {groups[letter].map((brand) => {
                      const isChecked = selectedBrandIds.includes(brand.id);
                      return (
                        <label
                          key={brand.id}
                          className={`flex items-center gap-2 rounded-md px-2 py-2 cursor-pointer border transition-colors ${
                            isChecked
                              ? "border-[var(--color-primary,#DB3D26)]/40 bg-black/[0.03]"
                              : "border-transparent hover:bg-black/5"
                          }`}
                        >
                          <Checkbox
                            className="data-[state=checked]:primaryBackColor shadow-sm border-gray-300 border-[1.5px] shrink-0"
                            checked={isChecked}
                            onCheckedChange={() => onToggleBrand(brand)}
                          />
                          <span className="text-sm textColor truncate">
                            {brandName(brand)}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ),
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BrandSearchModal;
