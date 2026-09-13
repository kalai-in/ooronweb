import { t } from '@/utils/translation'
import React from 'react'

interface OrderAdressCardProps {
    // Order detail payload shape varies by order type (Quick vs Ecom) and has
    // no shared type yet — see AGENTS.md rule 4.
    orderDetail: any;
}

const OrderAdressCard = ({ orderDetail }: OrderAdressCardProps) => {
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

export default OrderAdressCard;