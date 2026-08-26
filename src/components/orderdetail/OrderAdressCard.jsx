import { t } from '@/utils/translation'
import React from 'react'

const OrderAdressCard = ({ orderDetail }) => {
    return (
        <div>
            <h2 className="text-sm font-bold mb-1.5">{t("deliver_to")}: {orderDetail?.user_name}</h2>
            <p className="text-sm SecondaryTextColor">
                {orderDetail?.address?.address}
            </p>
            <p className="mt-1.5 text-sm font-medium">{t("phone")} : {orderDetail?.address?.mobile}</p>
        </div>
    )
}

export default OrderAdressCard