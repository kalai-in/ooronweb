import React, { useEffect } from 'react'
import ProfileDashboard from '../profiledashboard/ProfileDashboard'
import { useSelector } from 'react-redux'
import CheckResetPassword from '@/HOC/CheckResetPassword'

const ResetPasswordPage = () => {
    const language = useSelector(state => state.Language.selectedLanguage)

    useEffect(() => { }, [language?.id])
    return (
        <ProfileDashboard />
    )
}

export default CheckResetPassword(ResetPasswordPage);