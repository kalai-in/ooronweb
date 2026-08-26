"use client";
import React, { useState, useEffect } from "react";
import BlogCard from "./BlogCard";
import BlogsCategories from "./BlogsCategories";
import RecentBlogs from "./RecentBlogs";
import * as api from "@/api/apiRoutes";
import BlogSkeleton, { BlogCardSkeleton } from "./BlogsSkeleton";
import { t } from "@/utils/translation";
import BreadCrumb from "../breadcrumb/BreadCrumb";
import PopularBlogTags from "./PopularBlogTags";
import ThemedSvg from "@/components/notfound/ThemedSvg";
import NoBlogImage from "@/assets/empty-state/no-blog.svg";

const Blogs = () => {
  const [blogs, setBlogs] = useState([]);
  const [blogsCategories, setBlogsCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedTag, setSelectedTag] = useState(null);
  const [mostViewedBlogs, setMostViewedBlogs] = useState([]);
  const [offset, setOffset] = useState(0);
  const [totalBlogs, setTotalBlogs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [blogsLoading, setBlogsLoading] = useState(false);
  const [blogsError, setBlogsError] = useState(false);
  const [tags, setTags] = useState([]);
  const topRef = React.useRef(null);

  const BLOG_LIMIT = 10;

  const handleTagFetch = async () => {
    try {
      const response = await api.getTags();
      setTags(response?.data);
    } catch (error) {
      console.log("error", error);
    }
  };

  const handleFetchBlogs = async (customOffset = 0, isFetchMore = false) => {
    setBlogsLoading(true);
    if (!isFetchMore) {
      setBlogsError(false);
    }
    try {
      const res = await api.getBlogs({
        offset: customOffset,
        limit: BLOG_LIMIT,
        categoryId: selectedCategory,
        tag_id: selectedTag,
      });
      if (isFetchMore) {
        setBlogs((prev) => [...prev, ...res.data]);
      } else {
        setBlogs(res?.data);
      }
      setOffset((prev) => prev + BLOG_LIMIT);
      setBlogsLoading(false);
      setTotalBlogs(res?.total);
    } catch (error) {
      setBlogsLoading(false);
      if (!isFetchMore) {
        setBlogsError(true);
      }
      console.log("error", error);
    }
  };

  const handleFetchBlogsCategories = async () => {
    setLoading(true);
    try {
      const res = await api.getBlogsCategories(0, 10);
      setBlogsCategories(res?.data);
      setLoading(false);
    } catch (error) {
      console.log("error", error);
      setLoading(false);
    }
  };

  const getMostViewedBlogs = async () => {
    setLoading(true);
    try {
      const response = await api.getMostViewedBlogs({ limit: 5 });
      setMostViewedBlogs(response.data);
      setLoading(false);
    } catch (error) {
      console.log("error", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount
    handleFetchBlogsCategories();
    getMostViewedBlogs();
    handleTagFetch();
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset pagination when filters change
    setOffset(0);
    handleFetchBlogs(0, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleFetchBlogs is redefined every render (not memoized); only filters should re-trigger the fetch
  }, [selectedCategory, selectedTag]);

  useEffect(() => {
    if (!blogsLoading && topRef.current) {
      topRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [blogsLoading]);

  const blogAvailable =
    blogsCategories?.length > 0 ||
    mostViewedBlogs?.length > 0 ||
    tags?.length > 0;

  const isFiltering = selectedCategory !== null || selectedTag !== null;

  return loading ? (
    <BlogSkeleton />
  ) : (
    <>
      <div ref={topRef}></div>
      <BreadCrumb />
      <div className="container my-12">
        <div className="grid lg:grid-cols-12 gap-6 grid-cols-1">
          <div
            className={`${isFiltering || blogs?.length > 0 ? "lg:col-span-8" : "lg:col-span-12"} md:col-span-12 col-span-12 flex flex-col gap-6`}
          >
            {!blogsLoading && blogsError && (
              <div className="w-full flex flex-col justify-center items-center gap-3 min-h-[420px] text-center bodyBackgroundColor border rounded-2xl p-10">
                <h1 className="text-xl font-bold textColor mt-1">
                  {t("something_went_wrong") || "Something went wrong"}
                </h1>
                <button
                  type="button"
                  onClick={() => handleFetchBlogs(0, false)}
                  className="mt-3 primaryBackColor text-white text-sm font-semibold px-6 py-2.5 rounded-lg"
                >
                  {t("retry") || t("try_again") || "Retry"}
                </button>
              </div>
            )}
            {!blogsLoading && !blogsError && blogs?.length === 0 && (
              <div className="w-full flex flex-col justify-center items-center gap-3 min-h-[420px] text-center bodyBackgroundColor border rounded-2xl p-10">
                <ThemedSvg
                  src={NoBlogImage}
                  alt={t("noBlogFound")}
                  className="w-3/4 max-w-[220px]"
                />
                <h1 className="text-xl font-bold textColor mt-1">
                  {t("noBlogFound")}
                </h1>
                <p className="subTextColor text-sm max-w-sm">
                  {isFiltering
                    ? t("tryDifferentCategory")
                    : t("checkBackLater")}
                </p>
                {isFiltering && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory(null);
                      setSelectedTag(null);
                    }}
                    className="mt-3 primaryBackColor text-white text-sm font-semibold px-6 py-2.5 rounded-lg"
                  >
                    {t("viewAllBlogs")}
                  </button>
                )}
              </div>
            )}
            {(blogsLoading || blogs?.length > 0) && (
              <div className="grid lg:grid-cols-2 grid-cols-1 md:grid-cols-2 gap-6">
                {blogsLoading
                  ? Array.from({ length: 4 }).map((_, i) => (
                      <BlogCardSkeleton key={`blog-skeleton-${i}`} />
                    ))
                  : blogs?.map((blog) => (
                      <BlogCard key={blog?.id ?? blog?.slug} blog={blog} />
                    ))}
              </div>
            )}
            {blogs?.length < totalBlogs && (
              <div className="w-full flex justify-center mt-6">
                <button
                  type="button"
                  className="bg-[#29363f] rounded-md text-white text-base font-medium gap-1 p-1.5 px-3"
                  onClick={() => handleFetchBlogs(offset, true)}
                >
                  {t("load_more")}
                </button>
              </div>
            )}
          </div>

          {blogAvailable && (isFiltering || blogs?.length > 0) && (
            <div className="lg:col-span-4 md:col-span-12 col-span-12 flex flex-col gap-6">
              {blogsCategories?.length > 0 && (
                <BlogsCategories
                  blogsCategories={blogsCategories}
                  selectedCategory={selectedCategory}
                  setSelectedCategory={setSelectedCategory}
                />
              )}
              {mostViewedBlogs?.length > 0 && (
                <RecentBlogs mostViewedBlogs={mostViewedBlogs} />
              )}
              {tags?.length > 0 && (
                <PopularBlogTags
                  tags={tags}
                  setSelectedTag={setSelectedTag}
                  selectedTag={selectedTag}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Blogs;
