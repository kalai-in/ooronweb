import { useState, useEffect } from "react";
import ImageWithPlaceholder from "../image-with-placeholder/ImageWithPlaceholder";
import { t } from "@/utils/translation";
import { sanitizeHtml } from "@/utils/sanitizeHtml";
import { useRouter } from "next/router";
import * as api from "@/api/apiRoutes";
import { formatCustomDate } from "@/lib/utils";
import Loader from "../loader/Loader";
import BreadCrumb from "../breadcrumb/BreadCrumb";
import RecentBlogsSwiper from "./RecentBlogsSwiper";
import Custom404 from "@/pages/404";
import { BiCalendar, BiTime } from "react-icons/bi";
import {
  FacebookIcon,
  FacebookShareButton,
  LinkedinShareButton,
  LinkedinIcon,
  WhatsappShareButton,
  WhatsappIcon,
} from "react-share";
import { usePathname } from "next/navigation";

const BlogDetail = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { slug } = router.query;
  const [blog, setBlog] = useState(null);
  const [loading, setLoading] = useState(false);
  const [tags, setTags] = useState([]);
  const [recentBlogs, setRecentBlogs] = useState([]);
  // In static-export mode (NEXT_PUBLIC_SEO=false) there's no getServerSideProps,
  // so a bad slug can't 404 on the server — the shell loads and this component
  // fetches client-side. Track "fetched but empty" so we can render the custom
  // 404 UI instead of an empty page.
  const [notFound, setNotFound] = useState(false);

  const handleFetchBlogs = async (blogId) => {
    try {
      const blogs = await api.getBlogs({
        offset: 0,
        limit: 10,
      });
      const filteredBlogs = blogs?.data?.filter((blog) => blog.id !== blogId);
      setRecentBlogs(filteredBlogs);
    } catch (error) {
      console.log("error", error);
    }
  };

  const handleSetBlogCount = async (blogData) => {
    try {
      await api.setBlogCount({ blogId: blogData?.id });
    } catch (error) {
      console.log("error", error);
    }
  };

  const handleFetchBlog = async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const res = await api.getBlogs({ slug: slug });
      const found = res?.data?.[0];
      if (!found) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setBlog(found);
      handleSetBlogCount(found);
      handleFetchBlogs(found?.id);
      setTags(found?.tag_names);
      setLoading(false);
    } catch (error) {
      setLoading(false);
      setNotFound(true);
      console.log("error", error);
    }
  };

  useEffect(() => {
    if (!slug) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on slug change
    handleFetchBlog();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleFetchBlog is redefined every render (not memoized); only slug should re-trigger the fetch
  }, [slug]);

  const shareUrl = `${process.env.NEXT_PUBLIC_BASE_URL}${decodeURI(pathname || "")}`;

  if (notFound) return <Custom404 />;

  return loading ? (
    <Loader />
  ) : (
    <>
      <BreadCrumb title={blog?.translations?.title || blog?.title} />
      <div className="">
        <div className="bodyBackgroundColor">
          <div className="container py-10">
            {/* Hero: image with floating overlap card */}
            <div className="relative">
              {/* Fixed 1200×630 (OG-image) aspect so every blog hero is the same
                  shape, but CONTAINED, not cropped — banners carry text to the
                  edges, which object-cover cut off. Matches the grid cards. */}
              <div className="relative aspect-[1200/630] w-full overflow-hidden rounded-2xl bg-gray-50 dark:bg-zinc-800">
                <ImageWithPlaceholder
                  className="h-full w-full object-contain"
                  src={blog?.image_url}
                  alt={blog?.title}
                  height={630}
                  width={1200}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
              </div>
              <div className="relative -mt-12 sm:-mt-16 mx-4 sm:mx-auto sm:max-w-2xl bg-white rounded-2xl shadow-lg border border-gray-100 px-6 py-5 sm:px-8 sm:py-6 flex flex-col items-center text-center gap-2.5">
                {(blog?.category?.translations?.name ||
                  blog?.category?.name) && (
                  <span className="max-w-full text-xs font-bold uppercase tracking-wider primaryColor [overflow-wrap:anywhere]">
                    {blog?.category?.translations?.name || blog?.category?.name}
                  </span>
                )}
                <h1 className="max-w-full font-extrabold text-xl sm:text-2xl md:text-3xl leading-tight textColor [overflow-wrap:anywhere]">
                  {blog?.translations?.title || blog?.title}
                </h1>
                <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 subTextColor text-sm font-medium pt-1">
                  <span className="flex items-center gap-1.5">
                    <BiCalendar size={15} />
                    {formatCustomDate(blog?.created_at)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <BiTime size={15} />
                    {blog?.read_time}
                  </span>
                </div>
              </div>
            </div>
            {/* Lead excerpt — the short_description, styled as a standout intro
                (larger, primary-accent quote bar) so it reads clearly apart from
                the full article body below. */}
            {(blog?.translations?.short_description ||
              blog?.short_description) &&
              (blog?.translations?.short_description || blog?.short_description)
                ?.trim()
                ?.toLowerCase() !==
                (blog?.translations?.title || blog?.title)
                  ?.trim()
                  ?.toLowerCase() && (
                <div
                  style={{ maxWidth: "64rem" }}
                  className="mx-auto mt-8 w-full"
                >
                  <p className="border-s-4 primaryColorBorder ps-4 text-start text-lg font-medium italic leading-relaxed textColor [overflow-wrap:anywhere]">
                    {blog?.translations?.short_description ||
                      blog?.short_description}
                  </p>
                </div>
              )}
          </div>
        </div>
        <div className="container ">
          <div
            style={{ maxWidth: "64rem" }}
            className="mx-auto w-full !text-start api-html-content"
            dangerouslySetInnerHTML={sanitizeHtml(
              blog?.translations?.description || blog?.description,
            )}
          ></div>
          {tags.length > 0 && (
            <div style={{ maxWidth: "64rem" }} className="mx-auto w-full">
              <div className="border my-10"></div>
              <div className="w-full backgroundColor  border  p-4 rounded-xl flex  items-start md:items-center justify-between flex-col md:flex-row ">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{t("tags")}:</span>

                  {tags?.map((tag) => (
                    <span
                      key={tag}
                      className=" bodyBackgroundColor  text-sm px-3 py-1 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2 mt-4 md:mt-0">
                  <span className="font-semibold">{t("share")}:</span>

                  {[
                    [FacebookShareButton, FacebookIcon, "Facebook"],
                    [LinkedinShareButton, LinkedinIcon, "LinkedIn"],
                    [WhatsappShareButton, WhatsappIcon, "WhatsApp"],
                  ].map(([ShareButton, Icon, label]) => (
                    <ShareButton
                      key={label}
                      url={shareUrl}
                      aria-label={`${t("share")} ${label}`}
                      title={label}
                      className="rounded-full transition-transform hover:-translate-y-0.5 hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-color)]"
                    >
                      <Icon
                        size={36}
                        round
                        bgStyle={{ fill: "#374151" }}
                        iconFillColor="#ffffff"
                      />
                    </ShareButton>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <RecentBlogsSwiper recentBlogs={recentBlogs} />
    </>
  );
};

export default BlogDetail;
