import React, { useEffect } from 'react'
import FAQs from '../faqs/FAQs'
import { useSelector } from 'react-redux'

const FAQsPage = () => {
    const language = useSelector(state => state.Language.selectedLanguage)

    useEffect(() => { }, [language?.id])
    return (
        <FAQs />
    )
}

export default FAQsPage
