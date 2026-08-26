import React from "react";

// Individual Skeleton Components
export const ProductCardSkeleton = () => (
  <div className="animate-pulse p-3 border rounded-md">
    <div className="flex gap-3">
      <div className="w-16 h-16 bg-gray-300 rounded-md"></div>
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-gray-300 rounded w-3/4"></div>
        <div className="h-3 bg-gray-300 rounded w-1/2"></div>
        <div className="flex justify-between items-center">
          <div className="h-3 bg-gray-300 rounded w-1/4"></div>
          <div className="flex gap-2">
            <div className="w-8 h-8 bg-gray-300 rounded"></div>
            <div className="w-6 h-8 bg-gray-300 rounded"></div>
            <div className="w-8 h-8 bg-gray-300 rounded"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
);

export const CouponSkeleton = () => (
  <div className="animate-pulse mb-2">
    <div className="flex justify-between items-center">
      <div className="h-4 bg-gray-300 rounded w-1/4"></div>
      <div className="h-8 bg-gray-300 rounded w-20"></div>
    </div>
  </div>
);

export const AppliedCouponSkeleton = () => (
  <div className="animate-pulse">
    <div className="flex justify-between items-center primaryDashedBorder mb-2">
      <div className="flex p-2 items-center gap-2">
        <div className="w-8 h-8 bg-gray-300 rounded"></div>
        <div className="w-3/4 space-y-1">
          <div className="h-4 bg-gray-300 rounded w-3/4"></div>
          <div className="h-3 bg-gray-300 rounded w-1/2"></div>
        </div>
        <div className="flex flex-col justify-start space-y-1">
          <div className="h-4 bg-gray-300 rounded w-12"></div>
          <div className="h-3 bg-gray-300 rounded w-10"></div>
        </div>
      </div>
    </div>
  </div>
);

export const TotalSkeleton = () => (
  <div className="animate-pulse space-y-6">
    <div className="flex justify-between">
      <div className="h-4 bg-gray-300 rounded w-12"></div>
      <div className="h-4 bg-gray-300 rounded w-16"></div>
    </div>
  </div>
);

export const ButtonsSkeleton = () => (
  <div className="animate-pulse mt-4 space-y-2">
    <div className="w-full h-10 bg-gray-300 rounded-md"></div>
    <div className="w-full h-10 bg-gray-300 rounded-md"></div>
  </div>
);

// Main Cart Drawer Loading Component
const CartDrawerSkeletons = () => {
  return (
    <>
      {/* Product Cards Skeleton */}
      <div className="flex-grow overflow-y-auto gap-2 p-2 flex flex-col">
        {Array.from({ length: 3 }).map((_, index) => (
          <ProductCardSkeleton key={index} />
        ))}
      </div>
      
      {/* Bottom Section Skeleton */}
      <div className="w-full mx-auto p-4 border rounded-md shadow-sm sticky bottom-0">
        <CouponSkeleton />
        <TotalSkeleton />
        <ButtonsSkeleton />
      </div>
    </>
  );
};

export default CartDrawerSkeletons;