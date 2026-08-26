import React from 'react'
const TransactionHistory = dynamic(()=>import('@/components/pagecomponents/TransactionHistoryPage'),{ssr:false})
import MetaData from '@/components/metadata-component/MetaData'
import dynamic from 'next/dynamic'

const Transaction = () => {
  return (
    <div>
      <MetaData
        robots="noindex, nofollow" pageName="/profile/transactions" title={`Transactions - ${process.env.NEXT_PUBLIC_META_TITLE}`} />
      <TransactionHistory />
    </div>
  )
}

export default Transaction