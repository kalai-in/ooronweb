"use client";

import React, { useEffect } from 'react'
import ProfileDashboard from '../profiledashboard/ProfileDashboard'
import { useSelector } from 'react-redux'
import AuthGate from '@/components/auth/AuthGate'

const ResetPasswordPageInner = () => {
    const language = useSelector((state: any) => state.Language.selectedLanguage)

    useEffect(() => { }, [language?.id])
    return (
        <ProfileDashboard />
    )
}

const ResetPasswordPage = () => (
    <AuthGate requireResetEligible>
        <ResetPasswordPageInner />
    </AuthGate>
);

export default ResetPasswordPage;