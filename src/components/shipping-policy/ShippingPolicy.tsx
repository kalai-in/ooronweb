import React from 'react'
import BreadCrumb from '../breadcrumb/BreadCrumb'
import { useSelector } from 'react-redux';
import { sanitizeHtml } from '@/utils/sanitizeHtml';

const ShippingPolicy = () => {
    const setting = useSelector((state: any) => state?.Setting?.setting);
    const countrySetting = useSelector((state: any) => state.CountrySetting.countrySetting);
    const policyContent = countrySetting?.shipping_policy || setting?.shipping_policy || "";

    return (
        <section>
            <div>
                <BreadCrumb />
            </div>
            <div className='container my-5 bodyBackgroundColor px-1 md:px-0'>
                <div
                    className='flex flex-col gap-4 rounded p-3 items-start [&_ul]:list-disc [&_ul]:pl-5 backgroundColor infoContent [&_a]:text-[revert] [&_a]:underline md:p-7'
                    dangerouslySetInnerHTML={sanitizeHtml(policyContent)}
                />
            </div>
        </section>
    )
}

export default ShippingPolicy
