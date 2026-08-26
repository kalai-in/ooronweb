import VegIcon from "@/assets/icon/Veg.svg";
import NonVegIcon from "@/assets/icon/Non-Veg.svg";
import MedicalIcon from "@/assets/icon/Medical.svg";
import EggetarianIcon from "@/assets/icon/eggetarian.svg";
import ChemicalIcon from "@/assets/icon/chemical.svg";

// Product type indicator: 0-none | 1-veg | 2-non-veg | 3-chemical | 4-eggetarian | 5-medical.
// Veg / non-veg use SVG badges; the rest use Lucide icons. Each carries a soft background.
// Returns badge meta (svg src OR icon component + label key + text color + bg), or null for none.
export const getProductTypeMeta = (indicator) => {
  switch (Number(indicator)) {
    case 1:
      return {
        svg: VegIcon,
        labelKey: "vegetarian",
        color: "text-green-600",
        bg: "primaryLightBack", // custom soft green bg from theme
      };
    case 2:
      return {
        svg: NonVegIcon,
        labelKey: "non-vegetarian",
        color: "text-red-600",
        bg: "primaryLightBack", // custom soft red bg from theme
      };
    case 3:
      return {
        svg: ChemicalIcon,
        labelKey: "chemical",
        color: "primaryColor",
        bg: "primaryLightBack",
      };
    case 4:
      return {
        svg: EggetarianIcon,
        labelKey: "eggetarian",
        color: "primaryColor",
        bg: "primaryLightBack",
      };
    case 5:
      return {
        svg: MedicalIcon,
        labelKey: "medical",
        color: "primaryColor",
        bg: "primaryLightBack",
      };
    default:
      return null;
  }
};
