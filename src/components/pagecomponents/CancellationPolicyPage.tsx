"use client";

import React, { useEffect } from 'react'
import CancellationPolicy from '../cancellation-policy/CancellationPolicy'
import { useSelector } from 'react-redux'

const CancellationPolicyPage = () => {
    const language = useSelector((state: any) => state.Language.selectedLanguage)

    useEffect(() => { }, [language?.id])
    return (
        <CancellationPolicy />
    )
}

export default CancellationPolicyPage
