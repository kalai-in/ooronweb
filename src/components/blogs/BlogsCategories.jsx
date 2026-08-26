import React from "react";
import { t } from "@/utils/translation";

const BlogsCategories = ({
  blogsCategories,
  selectedCategory,
  setSelectedCategory,
}) => {
  const totalCount = blogsCategories?.reduce(
    (sum, c) => sum + Number(c?.active_blogs_count || 0),
    0
  );

  return (
    <div className="flex flex-col p-4 gap-4 border rounded-xl backgroundColor">
      <h2 className="font-bold text-lg">{t("categories")}</h2>
      <div className="flex flex-col gap-2.5">
        {/* All — clears the filter */}
        <button
          type="button"
          onClick={() => setSelectedCategory(null)}
          className={`flex justify-between items-center gap-2 p-3 rounded-lg font-semibold text-sm transition-colors ${
            selectedCategory == null
              ? "primaryBackColor text-white"
              : "headerBackgroundColor textColor hover:opacity-80"
          }`}
        >
          <span>{t("all")}</span>
          <span className="text-xs opacity-90">({totalCount})</span>
        </button>

        {blogsCategories?.map((category) => {
          const isActive = selectedCategory == category?.id;
          return (
            <button
              type="button"
              key={category?.id}
              onClick={() =>
                setSelectedCategory(isActive ? null : category?.id)
              }
              className={`flex justify-between items-center gap-2 p-3 rounded-lg font-semibold text-sm transition-colors ${
                isActive
                  ? "primaryBackColor text-white"
                  : "headerBackgroundColor textColor hover:opacity-80"
              }`}
            >
              <span className="truncate text-start">
                {category?.translations?.name || category?.name}
              </span>
              <span className="text-xs opacity-90 shrink-0">
                ({category?.active_blogs_count})
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default BlogsCategories;
