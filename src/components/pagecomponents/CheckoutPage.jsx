import React, { useEffect } from 'react'
import dynamic from 'next/dynamic'
import withAuth from '@/checkauth/CheckAuth';
const Checkout = dynamic(() => import('../checkoutpage/CheckoutUI'), { ssr: false });
import { useSelector } from 'react-redux';

const CheckoutPage = () => {
    const language = useSelector(state => state.Language.selectedLanguage)

    useEffect(() => { }, [language?.id])
    return (
        <Checkout />
    )
}

export default withAuth(CheckoutPage)