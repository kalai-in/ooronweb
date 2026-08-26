import React, { useEffect } from 'react'
import Brands from '../shop-by-brands/Brand'
import { useSelector } from 'react-redux'

const BrandsPage = () => {
    const language = useSelector(state => state.Language.selectedLanguage)

    useEffect(() => { }, [language?.id])
    return (
        <Brands />
    )
}

export default BrandsPage
