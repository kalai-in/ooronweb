import React, { useEffect } from 'react'
import ProfileDashboard from '../profiledashboard/ProfileDashboard'
import { useSelector } from 'react-redux'


const ActiceOrdersPage = () => {
    const language = useSelector(state => state.Language.selectedLanguage)

    useEffect(() => { }, [language?.id])
    return (
        <ProfileDashboard />
    )
}

export default ActiceOrdersPage