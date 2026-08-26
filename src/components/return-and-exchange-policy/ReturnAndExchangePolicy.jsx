import React from 'react'
import BreadCrumb from '../breadcrumb/BreadCrumb'
import { useSelector } from 'react-redux'
import { sanitizeHtml } from '@/utils/sanitizeHtml'

const ReturnAndExchangePolicy = () => {
    const setting = useSelector((state) => state?.Setting?.setting);
    const countrySetting = useSelector((state) => state.CountrySetting.countrySetting);

    const policyContent = countrySetting?.return_policy || setting?.returns_and_exchanges_policy || "";

    return (
        <section>
            <div>
                <BreadCrumb />
            </div>
            <div className='container bodyBackgroundColor my-5 px-1 md:px-0 '>
                <div
                    className='flex flex-col gap-4 rounded p-4 items-start [&_ul]:list-disc [&_ul]:pl-5 backgroundColor infoContent [&_a]:text-[revert] [&_a]:underline md:p-7'
                    dangerouslySetInnerHTML={sanitizeHtml(policyContent)}
                />
            </div>
        </section>
    )
}

export default ReturnAndExchangePolicy
