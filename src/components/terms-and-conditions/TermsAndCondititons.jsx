import React from 'react'
import BreadCrumb from '../breadcrumb/BreadCrumb'
import { useSelector } from 'react-redux'
import { sanitizeHtml } from '@/utils/sanitizeHtml'

const TermsAndCondititons = () => {
    const setting = useSelector((state) => state?.Setting?.setting);
    const countrySetting = useSelector((state) => state.CountrySetting.countrySetting);
    const policyContent = countrySetting?.terms_conditions || setting?.terms_conditions || "";

    return (
        <section>
            <div>
                <BreadCrumb />
            </div>
            <div className='container my-5  bodyBackgroundColor px-1 md:px-0'>

                <div
                    className='flex flex-col gap-4 rounded p-4 items-start [&_ul]:list-disc [&_ul]:pl-5 backgroundColor infoContent [&_a]:text-[revert] [&_a]:underline md:p-7'
                    dangerouslySetInnerHTML={sanitizeHtml(policyContent)}
                />

            </div>
        </section>
    )
}

export default TermsAndCondititons
