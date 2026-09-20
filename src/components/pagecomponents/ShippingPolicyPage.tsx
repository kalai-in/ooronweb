"use client";

import React, { useEffect } from 'react'
import ShippingPolicy from '../shipping-policy/ShippingPolicy'
import { useSelector } from 'react-redux'

const ShippingPolicyPage = () => {
    const language = useSelector((state: any) => state.Language.selectedLanguage)

    useEffect(() => { }, [language?.id])
    return (
        <ShippingPolicy />
    )
}

export default ShippingPolicyPage
