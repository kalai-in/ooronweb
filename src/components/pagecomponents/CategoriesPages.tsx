"use client";

import React, { useEffect } from 'react'
import Category from '../categories/Category'
import { useSelector } from 'react-redux'

const CategoriesPages = ({ initialCategory = null }: { initialCategory?: any }) => {
    const language = useSelector((state: any) => state.Language.selectedLanguage)

    useEffect(() => {

    }, [language?.id])
    return (
        <Category initialCategory={initialCategory} />
    )
}

export default CategoriesPages