import React, { useEffect } from 'react'
import { useRouter } from 'next/router'
import OrderDetail from '../orderdetail/OrderDetail'
import EcomOrderDetail from '../orderdetail/EcomOrderDetail'
import { useSelector } from 'react-redux'

const OrderDetailPage = () => {
    const router = useRouter()
    const language = useSelector(state => state.Language.selectedLanguage)
    // ?type=ecommerce → E-commerce order detail (ecom_orders by order_item_id).
    // Otherwise the existing Quick Order detail flow, untouched.
    const isEcom = router.query?.type === 'ecommerce'

    useEffect(() => { }, [language?.id])
    return (
        isEcom ? <EcomOrderDetail /> : <OrderDetail />
    )
}

export default OrderDetailPage
