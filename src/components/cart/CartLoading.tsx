// components/skeletons/CartSkeleton.js
import React from 'react';

// Base skeleton animation component
const SkeletonBox = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse bg-gray-200 rounded ${className}`}></div>
);

// Individual cart product card skeleton
export const CartProductSkeleton = () => (
  <div className="grid grid-cols-12 items-center gap-4 p-4 border-b min-w-[600px]">
    {/* Product Image and Details */}
    <div className="col-span-4 flex space-x-4">
      <SkeletonBox className="w-16 h-16 rounded-sm" />
      <div className="flex-1 space-y-2">
        <SkeletonBox className="h-5 w-3/4" />
        <SkeletonBox className="h-3 w-1/2" />
      </div>
    </div>

    {/* Product Price */}
    <div className="col-span-2 text-center space-y-1">
      <SkeletonBox className="h-5 w-16 mx-auto" />
      <SkeletonBox className="h-3 w-12 mx-auto" />
    </div>

    {/* Quantity Selector */}
    <div className="col-span-3 flex items-center justify-center">
      <SkeletonBox className="h-10 w-24 rounded" />
    </div>

    {/* Total Price */}
    <div className="col-span-2 text-center">
      <SkeletonBox className="h-5 w-16 mx-auto" />
    </div>

    {/* Remove Button */}
    <div className="col-span-1 text-center">
      <SkeletonBox className="h-6 w-6 mx-auto" />
    </div>
  </div>
);

// Cart products table skeleton
export const CartProductsTableSkeleton = () => (
  <div className="col-span-12 md:col-span-8 cardBorder rounded-sm w-full overflow-hidden">
    <div className="w-full overflow-x-auto">
      {/* Table Header */}
      <div className="grid grid-cols-12 gap-4 min-w-[600px] p-4 font-medium border-b border-gray-300">
        <div className="col-span-4 font-bold">Product</div>
        <div className="col-span-2 text-center font-bold">Price</div>
        <div className="col-span-3 text-center font-bold">Quantity</div>
        <div className="col-span-2 text-center font-bold">Total</div>
        <div className="col-span-1 text-center font-bold">Action</div>
      </div>

      {/* Skeleton Rows */}
      {Array.from({ length: 3 }).map((_, index) => (
        <CartProductSkeleton key={index} />
      ))}
    </div>
  </div>
);

// Cart coupon card skeleton
export const CartCouponSkeleton = () => (
  <div className="col-span-12 md:col-span-4 cardBorder rounded-sm p-4 space-y-4">
    {/* Title */}
    <SkeletonBox className="h-6 w-32" />
    
    {/* Coupon input area */}
    <div className="space-y-3">
      <SkeletonBox className="h-10 w-full rounded" />
      <SkeletonBox className="h-8 w-24" />
    </div>

    {/* Divider */}
    <div className="border-t border-gray-200 my-4"></div>

    {/* Price breakdown */}
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <SkeletonBox className="h-4 w-16" />
        <SkeletonBox className="h-4 w-12" />
      </div>
      <div className="flex justify-between items-center">
        <SkeletonBox className="h-4 w-20" />
        <SkeletonBox className="h-4 w-12" />
      </div>
      <div className="flex justify-between items-center">
        <SkeletonBox className="h-4 w-12" />
        <SkeletonBox className="h-4 w-12" />
      </div>
      
      {/* Total */}
      <div className="border-t border-gray-200 pt-3">
        <div className="flex justify-between items-center">
          <SkeletonBox className="h-5 w-16" />
          <SkeletonBox className="h-5 w-16" />
        </div>
      </div>
    </div>

    {/* Checkout button */}
    <SkeletonBox className="h-12 w-full rounded" />
  </div>
);

// Complete cart page skeleton
export const CartPageSkeleton = () => (
  <section>
    <div className="container">
      <div className="my-12 px-2">
        {/* Header skeleton */}
        <div className="flex flex-col gap-1 mb-6">
          <SkeletonBox className="h-8 w-32" />
          <SkeletonBox className="h-5 w-64" />
        </div>

        {/* Main cart content */}
        <div className="grid grid-cols-12 gap-4 mt-6">
          <CartProductsTableSkeleton />
          <CartCouponSkeleton />
        </div>
      </div>
    </div>
  </section>
);

// Mini cart skeleton (for other components if needed)
export const MiniCartSkeleton = () => (
  <div className="space-y-3 p-4">
    {Array.from({ length: 2 }).map((_, index) => (
      <div key={index} className="flex items-center space-x-3">
        <SkeletonBox className="w-12 h-12 rounded" />
        <div className="flex-1 space-y-2">
          <SkeletonBox className="h-4 w-3/4" />
          <SkeletonBox className="h-3 w-1/2" />
        </div>
        <SkeletonBox className="h-4 w-12" />
      </div>
    ))}
  </div>
);

// Product card skeleton (for product listings if needed)
export const ProductCardSkeleton = () => (
  <div className="cardBorder rounded-sm overflow-hidden">
    <SkeletonBox className="h-48 w-full" />
    <div className="p-4 space-y-3">
      <SkeletonBox className="h-5 w-3/4" />
      <SkeletonBox className="h-4 w-1/2" />
      <div className="flex justify-between items-center">
        <SkeletonBox className="h-5 w-16" />
        <SkeletonBox className="h-8 w-20 rounded" />
      </div>
    </div>
  </div>
);

export default CartPageSkeleton;