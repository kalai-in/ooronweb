import React from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import Filter from "./ProductFilter";
import { t } from "@/utils/translation";
import { RiCloseFill } from "react-icons/ri";
import { useSelector } from "react-redux";

const FilterDrawer = ({
  showFilter,
  setShowFilter,
  setProductResult,
  setOffset,
  minPrice,
  maxPrice,
  values,
  setValues,
  setMinPrice,
  setMaxPrice,
}) => {
  const language = useSelector((state) => state.Language.selectedLanguage);
  const {
    listing_source
  } = useSelector((state) => state.ProductFilter);


  return (
    <Sheet open={showFilter} onOpenChange={(open) => !open && setShowFilter(false)}>
      <SheetContent
        className="p-2 w-full sm:w-[400px] sm:max-w-[90vw] overflow-y-auto"
        side={language?.type == "RTL" ? "left" : "right"}
      >
        <SheetHeader className="px-0 py-3  flex justify-between text-left ">
          <SheetTitle className="text-2xl font-bold flex flex-row items-center p-0 justify-between">
            <p className="text-2xl font-bold">{t("filter")}</p>
            <div className="closeButtonBg rounded-full p-[8px] gap-[4px] cursor-pointer">
              <RiCloseFill
                size={22}
                onClick={() => setShowFilter(false)}
              />
            </div>
          </SheetTitle>
        </SheetHeader>
        <div>
          <Filter
            setProductResult={setProductResult}
            setOffset={setOffset}
            minPrice={minPrice}
            maxPrice={maxPrice}
            values={values}
            setValues={setValues}
            setMaxPrice={setMaxPrice}
            setMinPrice={setMinPrice}
            setShowFilter={setShowFilter}
            hideCategory={listing_source === "category"}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default FilterDrawer;
