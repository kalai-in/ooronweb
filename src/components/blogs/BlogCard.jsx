import ImageWithPlaceholder from "../image-with-placeholder/ImageWithPlaceholder";
import { BiCalendar, BiTime } from "react-icons/bi";
import { BsArrowUpRightCircle } from "react-icons/bs";
import { t } from "@/utils/translation";
import { useRouter } from "next/navigation";
import { formatOnlyDate } from "@/lib/utils";
import useZoneHref from "@/hooks/useZoneHref";

const BlogCard = ({ blog }) => {
  const zoneHref = useZoneHref();
  const router = useRouter();
  const handleViewMore = (slug) => {
    router.push(zoneHref(`/blog/${slug}`));
  };

  return (
    <div
      onClick={() => handleViewMore(blog?.slug)}
      className="flex h-full cursor-pointer flex-col overflow-hidden rounded-2xl border cardBorder bodyBackgroundColor shadow-sm"
    >
      {/* Image — fixed 16:9 box so every card is the same shape, but the artwork
          is CONTAINED, not cropped: blog banners carry text/logos to the edges,
          which object-cover sliced off. Letterboxing shows the tinted bg instead. */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-gray-50 dark:bg-zinc-800">
        <ImageWithPlaceholder
          className="h-full w-full object-contain"
          src={blog?.image_url}
          alt={blog?.translations?.title || blog?.title}
          width={390}
          height={220}
          quality={90}
          sizes="(max-width: 640px) 100vw, 390px"
        />
        {(blog?.category?.translations?.name || blog?.category?.name) && (
          <span className="absolute top-3 start-3 primaryBackColor text-white text-xs font-semibold px-3 py-1 rounded-full shadow-sm">
            {blog?.category?.translations?.name || blog?.category?.name}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex flex-col gap-2 p-4 grow">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs subTextColor">
          <span className="flex items-center gap-1.5">
            <BiCalendar size={13} className="primaryColor" />
            {formatOnlyDate(blog?.created_at)}
          </span>
          {blog?.read_time && (
            <span className="flex items-center gap-1.5">
              <BiTime size={13} className="primaryColor" />
              {blog?.read_time}
            </span>
          )}
        </div>

        <h2 className="font-bold text-lg leading-snug line-clamp-2 min-h-[3.5rem] textColor">
          {blog?.translations?.title || blog?.title}
        </h2>

        <h4 className="text-sm subTextColor line-clamp-2 min-h-[2.5rem]">
          {blog?.translations?.short_description || blog?.short_description}
        </h4>

        <span className="mt-auto pt-3 inline-flex items-center gap-1.5 text-sm font-semibold primaryColor">
          {t("readMore")}
          <BsArrowUpRightCircle />
        </span>
      </div>
    </div>
  );
};

export default BlogCard;
