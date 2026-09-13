"use client";

import React, { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import OrderDetail from '../orderdetail/OrderDetail'
import EcomOrderDetail from '../orderdetail/EcomOrderDetail'
import { useSelector } from 'react-redux'

const OrderDetailPage = () => {
    const searchParams = useSearchParams()
    const language = useSelector((state: any) => state.Language.selectedLanguage)
    // ?type=ecommerce → E-commerce order detail (ecom_orders by order_item_id).
    // Otherwise the existing Quick Order detail flow, untouched.
    const isEcom = searchParams?.get('type') === 'ecommerce'

    useEffect(() => { }, [language?.id])
    return (
        isEcom ? <EcomOrderDetail /> : <OrderDetail />
    )
}

export default OrderDetailPage
