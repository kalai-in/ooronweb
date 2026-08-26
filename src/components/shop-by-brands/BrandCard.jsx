import React from 'react'
import ImageWithPlaceholder from '../image-with-placeholder/ImageWithPlaceholder'

const BrandCard = ({ brand, variant = 'default' }) => {
    if (variant === 'featured') {
        return (
            <div className="flex flex-col items-center gap-2 cursor-pointer group">
                <div className="w-full aspect-square rounded-2xl brandBackgroundColor border border-transparent group-hover:cardBorder group-hover:headerBackgroundColor transition-all duration-300 flex items-center justify-center p-4 overflow-hidden">
                    <div className="relative w-full h-full">
                        <ImageWithPlaceholder
                            src={brand?.image_url}
                            alt={brand?.translations?.name ?? brand?.name}
                            sizes="120px"
                            fill
                            className="object-contain"
                        />
                    </div>
                </div>
                <span className="text-xs font-medium textColor text-center w-full truncate leading-tight">
                    {brand?.translations?.name ?? brand?.name}
                </span>
            </div>
        )
    }

    return (
        <div className="rounded-sm text-center flex flex-col items-center px-5 py-7 gap-2 border border-transparent brandBackgroundColor hover:cardBorder hover:textPrimaryColor hover:cursor-pointer hover:headerBackgroundColor transition-all duration-300">
            <div className='h-28 w-28 relative'>
                <ImageWithPlaceholder src={brand?.image_url} alt={brand?.translations?.name ?? brand?.name} sizes="112px" fill className="rounded-sm mx-auto object-cover mb-2" />
            </div>
            <div className="text-base font-semibold leading-[26px] text-center w-full truncate">{brand?.translations?.name ?? brand?.name}</div>
        </div>
    )
}

export default BrandCard