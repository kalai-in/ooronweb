import { useState } from 'react';
import {
    Dialog,
    DialogContent, DialogHeader
} from "@/components/ui/dialog";
import LightBox from '@/components/ui/LightBox';
import { t } from '@/utils/translation';
import ImageWithPlaceholder from '../image-with-placeholder/ImageWithPlaceholder';

const RatingImagesModal = ({ showImagesModal, setShowImagesModal, images }) => {

    const [showLightBox, setShowLightBox] = useState(false)
    const [imageIndex, setImageIndex] = useState(0)
    const [lightBoxImages, setLightBoxImages] = useState([])

    const handleLightBox = (index) => {
        const ratingImages = images?.map((img) => ({ src: img?.src ? img?.src : img }))
        setLightBoxImages(ratingImages)
        setImageIndex(index)
        setShowLightBox(true)
    }

    return (
        <div>
            <Dialog open={showImagesModal} onOpenChange={setShowImagesModal}>

                <DialogContent title={t("Rating_images")}>
                    <DialogHeader>
                        <h1 className='font-bold text-2xl'>{t("Rating_images")}</h1>
                    </DialogHeader>
                    <div className='flex flex-wrap gap-2 justify-center'>
                        {images?.map((image, index) => {
                            return (
                                <div className="relative w-24 h-24 rounded overflow-hidden" key={image?.src ?? image}>
                                    <ImageWithPlaceholder
                                        src={image}
                                        alt="Rating image"
                                        width={96}
                                        height={96}
                                        sizes="96px"
                                        quality={75}
                                        loading="lazy"
                                        className="h-full w-full object-cover"
                                        onClick={() => handleLightBox(index)}
                                    /></div>
                            )
                        })}
                    </div>
                </DialogContent>
            </Dialog>
            <LightBox showLightBox={showLightBox} setShowLightBox={setShowLightBox} images={lightBoxImages} imageIndex={imageIndex} />
        </div>
    )
}


export default RatingImagesModal