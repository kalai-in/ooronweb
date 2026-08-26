import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { RiCloseFill } from "react-icons/ri";
import { t } from '@/utils/translation';
import * as api from "@/api/apiRoutes"
import { toast } from 'react-toastify';

const CancelReasonModal = ({ showCancelMoodal, setShowCancelModal, selectedProduct, handleFetchOrderDetail }) => {

    const [loading, setLoading] = useState(false);
    const [cancelReason, setCancelReason] = useState("")

    const handleHideCancelModal = () => {
        setCancelReason("");
        setShowCancelModal(false)
    }

    const handleCancelOrder = async () => {
        if (!cancelReason) {
            toast.error(t("reason_is_required"))
            return
        }
        setLoading(true)
        try {
            const response = await api.changeOrderStatus({ orderId: selectedProduct?.order_id, orderItemId: selectedProduct?.id, status: 7, reason: cancelReason })
            if (response?.status == 1) {
                setCancelReason("");
                setLoading(false);
                toast.success(response.message);
                await handleFetchOrderDetail()
                setShowCancelModal(false)
            } else {
                toast.error(response.message)
                setLoading(false);
            }
        } catch (error) {
            // Surface the backend error so a 500 doesn't fail silently.
            console.log("Cancel error", error?.response?.status, error?.response?.data)
            toast.error(error?.response?.data?.message || t("something_went_wrong"))
            setLoading(false)
        }
    }

    return (
        <Dialog open={showCancelMoodal} onOpenChange={setShowCancelModal}>
            <DialogContent title={t("cancel")}>
                <DialogHeader className="font-bold text-2xl text-start flex flex-row justify-between">
                    {t("cancel")}
                    <button type="button" aria-label={t("close")} onClick={handleHideCancelModal} className='closeButtonBg rounded-full p-[8px] gap-[4px] cursor-pointer'>
                        <RiCloseFill size={22} />
                    </button>
                </DialogHeader>
                <div className='flex flex-col gap-1'>
                    <label htmlFor='cancel-reason' className='font-medium text-base'>{t("reason")}<span className='text-red-500'>*</span></label>
                    <textarea id='cancel-reason' name='cancel-reason' className='w-full outline-none cardBorder p-2 rounded-sm' placeholder={t("write_cancel_reason")} onChange={(e) => setCancelReason(e.target.value)} value={cancelReason}></textarea>
                </div>
                <div className='flex justify-end'>
                    {/* disabled while in-flight: a second click would fire another
                        cancel for an already-cancelled item, which the backend 500s on. */}
                    <button type="button" onClick={handleCancelOrder} disabled={loading || !cancelReason.trim()} className='py-1 px-3 primaryBackColor text-white rounded-sm font-normal text-xl disabled:opacity-60 disabled:cursor-not-allowed' >{loading ? t("loading") : t("submit")}</button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export default CancelReasonModal