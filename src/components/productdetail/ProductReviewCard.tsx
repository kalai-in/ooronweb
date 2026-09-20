import { useState } from 'react'
import LightBox from '@/components/ui/LightBox'
import type { Slide } from 'yet-another-react-lightbox'
import ImageWithPlaceholder from '../image-with-placeholder/ImageWithPlaceholder'
import { formatDate } from '@/utils/helperFunction'

interface ProductReviewCardProps {
    /** Review, raw API shape. */
    review: any
}

const ProductReviewCard = ({ review }: ProductReviewCardProps) => {

    const [showLightBox, setShowLightbox] = useState(false)
    const [imageIndex, setImageIndex] = useState(0)
    const [lightBoxImages, setLightBoxImages] = useState<Slide[]>([])


    const handleLightBox = (index: number) => {
        const images = review?.images?.map((img: any) => {
            return ({ src: img?.image_url })
        })
        setLightBoxImages(images ?? [])
        setImageIndex(index)
        setShowLightbox(true)
    }

    const rate = Number(review?.rate) || 0;
    const ratingColor =
        rate >= 4 ? "bg-[#388e3c]" : rate >= 3 ? "bg-[#db8c28]" : "bg-[#dc3545]";

    return (
        <div className="py-4 first:pt-0">
            {/* Flipkart-style: green rating pill inline with review text */}
            <div className="flex items-start gap-2.5">
                <span className={`inline-flex items-center gap-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-bold text-white ${ratingColor}`}>
                    {rate.toFixed(1)}
                    <span className="text-[10px] leading-none">★</span>
                </span>
                {review?.review && (
                    <p className="min-w-0 flex-1 text-sm font-medium leading-snug textColor [overflow-wrap:anywhere]">
                        {review?.review}
                    </p>
                )}
            </div>

            {review?.images?.length > 0 && (
                <div className="flex gap-2 flex-wrap mt-2.5">
                    {review?.images?.map((image: any, index: number) => (
                        <div className="w-16 h-16 rounded overflow-hidden border border-[var(--border-color)] cursor-pointer" key={index}>
                            <ImageWithPlaceholder src={image?.image_url} alt="Rating image" height={200} width={200} className="h-full w-full object-cover" handleOnClick={() => handleLightBox(index)} />
                        </div>
                    ))}
                </div>
            )}

            {/* Name · date row — muted, Flipkart footer */}
            <div className="flex items-center gap-2 mt-2.5 text-xs SecondaryTextColor">
                <span className="font-medium textColor">{review?.user?.name || "Anonymous"}</span>
                <span className="text-gray-300 dark:text-zinc-600">|</span>
                <span>{formatDate(review?.updated_at)}</span>
            </div>
            <LightBox showLightBox={showLightBox} setShowLightbox={setShowLightbox} images={lightBoxImages} imageIndex={imageIndex} />
        </div>
    )
}

export default ProductReviewCard
