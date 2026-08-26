import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "next/router";
import {
  setListingSource,
  setCategorySlug,
  setCategoryBreadcrumb,
} from "@/redux/slices/productFilterSlice";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import useZoneHref from "@/hooks/useZoneHref";
import useIsRtl from "@/hooks/useIsRtl";
import useUrlProductFilters from "@/hooks/useUrlProductFilters";

const CategoryFlowBreadcrumb = () => {
  const zoneHref = useZoneHref();
  const { buildQueryPatch } = useUrlProductFilters();
  const dispatch = useDispatch();
  const router = useRouter();
  const rtl = useIsRtl();

  const categoryBreadcrumb = useSelector(
    (state) => state.ProductFilter.categoryBreadcrumb,
  );

  if (!categoryBreadcrumb || categoryBreadcrumb.length === 0) return null;

  const handleBreadcrumbClick = (cat, index) => {
    const newBreadcrumb = categoryBreadcrumb.slice(0, index + 1);

    dispatch(setListingSource({ data: "category" }));
    dispatch(setCategorySlug({ data: cat.slug }));
    dispatch(setCategoryBreadcrumb({ data: newBreadcrumb }));

    router.push({
      pathname: zoneHref("/products"),
      query: buildQueryPatch({ category_id: cat.slug }),
    });
  };

  return (
    <div className="flex gap-2 text-sm SecondaryTextColor mb-3 mt-3 flex-wrap">
      {categoryBreadcrumb.map((cat, index) => (
        <span key={cat.id} className="flex items-center gap-2">
          <button
          type="button"
            onClick={() => handleBreadcrumbClick(cat, index)}
            className="hover:text-primary font-medium"
          >
            {cat.name}
          </button>
          {index < categoryBreadcrumb.length - 1 && (
            <span>
              {rtl ? <FaChevronLeft size={14} /> : <FaChevronRight size={14} />}
            </span>
          )}
        </span>
      ))}
    </div>
  );
};

export default CategoryFlowBreadcrumb;
