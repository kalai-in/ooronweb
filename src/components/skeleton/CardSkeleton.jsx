import React from 'react';
import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

// `variant="list"` mirrors ListViewProductCard: a short horizontal row with the
// thumbnail on the left and the text column beside it. The default block shape
// is a tall rectangle, which is right for the vertical grid card but wrong in
// list view — it rendered ~300px tall stacked blocks under real 140px rows, so
// the placeholder didn't match what loaded in.
const CardSkeleton = ({ height, width = "100%", padding, variant = "block" }) => {
    if (variant === "list") {
        return (
            <div className={`flex w-full ${padding ?? ""}`}>
                <div className="flex flex-row w-full min-h-[140px] gap-3 p-2.5 sm:p-3 border rounded-lg cardBorder">
                    {/* Thumbnail — same footprint as the real card's image box */}
                    <div className="shrink-0 self-start w-24 h-24 sm:w-28 sm:h-28">
                        <Skeleton height="100%" width="100%" borderRadius={12} />
                    </div>
                    {/* Text column: title, subtitle, price, then the action row
                        pinned to the bottom like the real card's mt-auto button. */}
                    <div className="flex flex-1 min-w-0 flex-col">
                        <Skeleton height={14} width="85%" />
                        <div className="mt-1">
                            <Skeleton height={12} width="45%" />
                        </div>
                        <div className="mt-2">
                            <Skeleton height={16} width="30%" />
                        </div>
                        <div className="mt-auto pt-2">
                            <Skeleton height={40} width="100%" borderRadius={8} />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`flex  w-full ${padding}`}>
            <div className="w-full border rounded-lg cardBorder p-4">
                <Skeleton height={height} width={width} />
            </div>
        </div>
    );
};

export default CardSkeleton;
