"use client";

import React, { useEffect } from 'react'
import PrivacyPolicy from '../privacy-policy/PrivacyPolicy'
import { useSelector } from 'react-redux'

const PrivacyPolicyPage = () => {
  const language = useSelector((state: any) => state.Language.selectedLanguage)

  useEffect(() => { }, [language?.id])
  return (
    <PrivacyPolicy />
  )
}

export default PrivacyPolicyPage
