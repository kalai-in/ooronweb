import React, { useEffect } from 'react'
import Category from '../categories/Category'
import { useSelector } from 'react-redux'

const CategoriesPages = () => {
    const language = useSelector(state => state.Language.selectedLanguage)

    useEffect(() => {

    }, [language?.id])
    return (
        <Category />
    )
}

export default CategoriesPages