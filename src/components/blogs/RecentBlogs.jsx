import React from "react";
import { t } from "@/utils/translation";
import ImageWithPlaceholder from "../image-with-placeholder/ImageWithPlaceholder";
import { useRouter } from "next/navigation";
import useZoneHref from "@/hooks/useZoneHref";

const RecentBlogs = ({ mostViewedBlogs }) => {
  const zoneHref = useZoneHref();
  const router = useRouter();

  const handleBlogNavigation = (slug) => {
    router.push(zoneHref(`/blog/${slug}`));
  };

  return (
    <div className="flex flex-col p-4 gap-6 border rounded-lg backgroundColor">
      <h2 className="font-bold  text-xl underline">{t("topViewedBlogs")}</h2>
      <div className="flex flex-col gap-6">
        {mostViewedBlogs?.map((blog) => {
          return (
            <div
              className="flex p-2 gap-2 headerBackgroundColor cursor-pointer rounded-lg"
              onClick={() => handleBlogNavigation(blog?.slug)}
              key={blog?.id}
            >
              <ImageWithPlaceholder
                className={"rounded-md object-cover flex-shrink-0 h-16 w-20 md:h-24 md:w-32 lg:w-24 xl:w-32"}
                src={blog?.image_url}
                alt={blog?.translations?.title || blog?.title}
                width={390}
                height={264}
              />
              <div className="flex flex-col gap-2 overflow-hidden">
                <p className="text-sm font-normal line-clamp-1">
                  {blog?.translations?.title || blog?.title}
                </p>
                <h2 className="font-bold !text-sm md:!text-base line-clamp-2">
                  {blog?.translations?.short_description || blog?.short_description}
                </h2>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RecentBlogs;
