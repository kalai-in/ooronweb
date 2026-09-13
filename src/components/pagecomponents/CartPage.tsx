"use client";

import React, { useEffect } from 'react'
import Cart from '../cart/Cart'
import { useSelector } from 'react-redux'

const CartPage = () => {
    const language = useSelector((state: any) => state.Language.selectedLanguage)

    useEffect(() => { }, [language?.id])
    return (
        <Cart />
    )
}

export default CartPage