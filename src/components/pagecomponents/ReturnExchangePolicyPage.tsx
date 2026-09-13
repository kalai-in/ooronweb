"use client";

import React, { useEffect } from 'react'
import ReturnAndExchangePolicy from '../return-and-exchange-policy/ReturnAndExchangePolicy'
import { useSelector } from 'react-redux'

const ReturnExchangePolicyPage = () => {
    const language = useSelector((state: any) => state.Language.selectedLanguage)

    useEffect(() => { }, [language?.id])
    return (
        <ReturnAndExchangePolicy />
    )
}

export default ReturnExchangePolicyPage
