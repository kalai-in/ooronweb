import React from 'react'
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";

// Common image lightbox (used by product ratings, prescription preview, etc).
const LightBox = ({ showLightBox, setShowLightbox, images, imageIndex }) => {
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
