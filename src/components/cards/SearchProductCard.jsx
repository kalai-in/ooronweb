import { setProductBySearch } from '@/redux/slices/productFilterSlice'
import Link from 'next/link'
import React from 'react'
import { useDispatch, useSelector } from 'react-redux'
import ImageWithPlaceholder from '../image-with-placeholder/ImageWithPlaceholder'
import useZoneHref from "@/hooks/useZoneHref";

const SearchProductCard = ({ product }) => {
  const zoneHref = useZoneHref();
    const dispatch = useDispatch()
    const setting = useSelector(state => state.Setting?.setting)

    const handleSearchProductClick = () => {
        // Clears the suggestion dropdown's cached results (redux). The typed
        // search text itself lives in Header.jsx (local state), not here.
        dispatch(setProductBySearch({ data: [] }))
    }

    // Search endpoint returns the image under images[].image_url (not a flat image_url),
    // with the variant image as a fallback.
    const productImage =
        product?.image_url ??
        product?.images?.[0]?.image_url ??
        product?.variants?.[0]?.image
    return (
        <Link href={zoneHref(`/product/${product?.slug}`)} prefetch={false} onClick={() => handleSearchProductClick()} className="w-full group">
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-100 dark:border-zinc-800/80 last:border-b-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-all duration-200">
                <div className="w-10 h-10 flex-shrink-0">
                    <ImageWithPlaceholder src={productImage} width={150} height={150} className="w-full h-full object-cover rounded-md border border-gray-100 dark:border-zinc-700/50" alt="product image" />
                </div>
                <div className="flex flex-col flex-grow text-start min-w-0">
                    <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 truncate group-hover:text-primary-color transition-colors duration-200">
                        {product?.translations?.name ?? product?.name}
                    </div>
                    <div className="text-xs font-medium mt-0.5">
                        {
                            product?.discounted_price ?
                                <div className="text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                                    <span>{setting?.currency}{product?.discounted_price}</span>
                                    <span className='line-through text-zinc-400 dark:text-zinc-500 font-normal'>{setting?.currency}{product?.price}</span>
                                </div> :
                                <div className="text-zinc-700 dark:text-zinc-300">{setting?.currency}{product?.price}</div>
                        }
                    </div>
                </div>
            </div>
        </Link>
    )
}

export default SearchProductCard
