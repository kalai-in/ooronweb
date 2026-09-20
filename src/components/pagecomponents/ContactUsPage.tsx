"use client";

import React, { useEffect } from 'react'
import ContactUs from '../contact-us/ContactUs'
import { useSelector } from 'react-redux'

const ContactUsPage = () => {
    const language = useSelector((state: any) => state.Language.selectedLanguage)

    useEffect(() => { }, [language?.id])
    return (
        <ContactUs />
    )
}

export default ContactUsPage
