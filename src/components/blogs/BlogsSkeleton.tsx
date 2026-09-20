import React from "react";

// Skeleton for BlogCard
export const BlogCardSkeleton = () => {
  return (
    <div className="backgroundColor rounded-lg shadow-md overflow-hidden animate-pulse">
      {/* Image skeleton */}
      <div className="w-full h-48 backgroundColor"></div>

      {/* Content skeleton */}
      <div className="p-4 space-y-3">
        {/* Category and date */}
        <div className="flex items-center gap-2">
          <div className="h-4 bodyBackgroundColor rounded w-20"></div>
          <div className="h-4 w-1 bodyBackgroundColor rounded-full"></div>
          <div className="h-4 bodyBackgroundColor rounded w-24"></div>
        </div>

        {/* Title */}
        <div className="space-y-2">
          <div className="h-5 bodyBackgroundColor rounded w-full"></div>
          <div className="h-5 bodyBackgroundColor rounded w-4/5"></div>
        </div>

        {/* Description */}
        <div className="space-y-2">
          <div className="h-4 bodyBackgroundColor rounded w-full"></div>
          <div className="h-4 bodyBackgroundColor rounded w-full"></div>
          <div className="h-4 bodyBackgroundColor rounded w-3/4"></div>
        </div>

        {/* Read more button */}
        <div className="pt-2">
          <div className="h-10 bodyBackgroundColor rounded w-28"></div>
        </div>
      </div>
    </div>
  );
};

// Skeleton for Categories
const CategoriesSkeleton = () => {
  return (
    <div className="backgroundColor rounded-lg p-6 animate-pulse">
      {/* Title */}
      <div className="h-6 bodyBackgroundColor rounded w-32 mb-4"></div>

      {/* Category items */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map((item) => (
          <div
            key={item}
            className="flex items-center justify-between p-3 rounded"
          >
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 bodyBackgroundColor rounded"></div>
              <div className="h-4 bodyBackgroundColor rounded w-32"></div>
            </div>
            <div className="h-5 bodyBackgroundColor rounded-full w-8"></div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Skeleton for Recent Blogs
const RecentBlogsSkeleton = () => {
  return (
    <div className="backgroundColor rounded-lg p-6 animate-pulse">
      {/* Title */}
      <div className="h-6 headerBackgroundColor rounded w-36 mb-4"></div>

      {/* Recent blog items */}
      <div className="space-y-4">
        {[1, 2, 3].map((item) => (
          <div key={item} className="flex gap-3">
            {/* Image */}
            <div className="w-20 h-20  rounded flex-shrink-0"></div>

            {/* Content */}
            <div className="flex-1 space-y-2">
              <div className="h-4 headerBackgroundColor rounded w-full"></div>
              <div className="h-4 headerBackgroundColor rounded w-4/5"></div>
              <div className="h-3 headerBackgroundColor rounded w-20"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Main Blogs Skeleton Component
const BlogsSkeleton = () => {
  return (
    <div className="container mx-auto my-12 px-4">
      <div className="grid md:grid-cols-12 gap-6 grid-cols-1">
        {/* Blog cards skeleton */}
        <div className="md:col-span-8 col-span-12 grid md:grid-cols-2 grid-cols-1 gap-6">
          {[1, 2, 3, 4].map((item) => (
            <BlogCardSkeleton key={item} />
          ))}
        </div>

        {/* Sidebar skeleton */}
        <div className="col-span-12 md:col-span-4 flex flex-col gap-6">
          <CategoriesSkeleton />
          <RecentBlogsSkeleton />
        </div>
      </div>
    </div>
  );
};

// Demo Component
export default function BlogSkeleton() {
  return (
    <div className="min-h-screen ">
      <BlogsSkeleton />
    </div>
  );
}
