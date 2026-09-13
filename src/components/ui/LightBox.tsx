import React from 'react'
import Lightbox, { type Slide } from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

interface LightBoxProps {
  showLightBox: boolean;
  setShowLightbox: (show: boolean) => void;
  images: Slide[];
  imageIndex: number;
}

// Common image lightbox (used by product ratings, prescription preview, etc).
const LightBox = ({ showLightBox, setShowLightbox, images, imageIndex }: LightBoxProps) => {
    return (
        <div>
            <Lightbox
                styles={{
                    container: {
                        backgroundColor: "#000000bf",
                    }
                }}
                index={imageIndex}
                open={showLightBox}
                close={() => setShowLightbox(false)}
                slides={images}
            />
        </div>
    )
}

export default LightBox
