import * as Slider from "@radix-ui/react-slider";
import Skeleton from "react-loading-skeleton";
import useCurrency from "@/hooks/useCurrency";

interface PriceSliderProps {
  values: number[];
  setValues: (values: number[]) => void;
  minPrice: number | null | undefined;
  maxPrice: number | null | undefined;
  setTempMinPrice: (value: number) => void;
  setTempMaxPrice: (value: number) => void;
}

const PriceSlider = ({
  values,
  setValues,
  minPrice,
  maxPrice,
  setTempMinPrice,
  setTempMaxPrice,
}: PriceSliderProps) => {
  const { currency } = useCurrency();

  const isLoading =
    minPrice === null ||
    maxPrice === null ||
    typeof minPrice === "undefined" ||
    typeof maxPrice === "undefined";

  // `values` is emptied on Clear All (and while the listing refetches). Falling
  // back to this slider's OWN min/max — the same bounds the track is drawn from
  // — parks both thumbs at the ends, i.e. "no price filter". Reading anything
  // else here left the thumbs mid-track over a full-width track after a clear.
  const currentValues =
    values?.length === 2 ? values : [Number(minPrice), Number(maxPrice)];

  const formatPrice = (value: number) => {
    const num = Math.round(Number(value ?? 0));
    return `${currency}${num.toLocaleString(undefined, {
      maximumFractionDigits: 0,
    })}`;
  };

  if (isLoading) {
    return (
      <div className="w-full">
        <Skeleton height={48} borderRadius={12} />
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Current range readout — fixed corners, never collide */}
      <div className="mb-3 flex items-center justify-between gap-2 text-sm font-semibold textColor">
        <span className="whitespace-nowrap">{formatPrice(currentValues[0])}</span>
        <span className="whitespace-nowrap">{formatPrice(currentValues[1])}</span>
      </div>

      {/* Slider */}
      <div className="px-0.5">
        <Slider.Root
          defaultValue={[minPrice, maxPrice]}
          min={minPrice}
          max={maxPrice}
          value={currentValues}
          step={1}
          minStepsBetweenThumbs={1}
          className="relative flex h-5 w-full touch-none select-none items-center"
          onValueChange={(newValues) => {
            setValues(newValues);
          }}
          onValueCommit={(newValues) => {
            setTempMinPrice(newValues[0]);
            setTempMaxPrice(newValues[1]);
          }}
        >
          <Slider.Track className="relative h-1.5 w-full grow rounded-full bg-gray-200">
            <Slider.Range className="absolute h-full rounded-full primaryBackColor" />
          </Slider.Track>

          {[0, 1].map((i) => (
            <Slider.Thumb
              key={i}
              aria-label={i === 0 ? "min price" : "max price"}
              className="block h-4 w-4 rounded-full border-2 border-white primaryBackColor shadow-[0_1px_3px_rgba(0,0,0,0.35)] transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-[var(--primary-color)] cursor-pointer"
            />
          ))}
        </Slider.Root>
      </div>
    </div>
  );
};

export default PriceSlider;
