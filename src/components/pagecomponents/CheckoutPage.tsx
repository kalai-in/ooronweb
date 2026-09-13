"use client";

import React, { useEffect } from 'react'
import Checkout from '../checkoutpage/CheckoutUI'
import AuthGate from '@/components/auth/AuthGate'
import { useSelector } from 'react-redux';

const CheckoutPageInner = () => {
    const language = useSelector((state: any) => state.Language.selectedLanguage)

    useEffect(() => { }, [language?.id])
    return (
        <Checkout />
    )
}

const CheckoutPage = () => (
    <AuthGate requireAuth>
        <CheckoutPageInner />
    </AuthGate>
);

export default CheckoutPage