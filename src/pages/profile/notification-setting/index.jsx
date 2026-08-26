import dynamic from 'next/dynamic'
import React from 'react'
const NotificationSettingPage = dynamic(() => import('@/components/pagecomponents/NotificationSettingPage'), { ssr: false });

const NotificationSetting = () => {
    return (
        <div>

            <NotificationSettingPage />
        </div>
    )
}

export default NotificationSetting
