"use client";

import React, { useEffect } from 'react'
import PaymentStatus from '../payment-status/PaymentStatus'
import { useSelector } from 'react-redux'

const PaymentStatusPage = () => {
    const language = useSelector((state: any) => state.Language.selectedLanguage)

    useEffect(() => { }, [language?.id])
    return (
        <PaymentStatus />
    )
}

export default PaymentStatusPage