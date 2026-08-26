import React, { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogOverlay
} from "@/components/ui/dialog"
import { t } from "@/utils/translation"
import { useSelector } from 'react-redux'
import * as api from "@/api/apiRoutes"
import { clearAllFilter } from "@/redux/slices/productFilterSlice";
import { logoutAuth, setJWTToken, setCurrentUser, setAuthType, } from "@/redux/slices/userSlice"
import { clearCartPromo, setCart, setCartProducts, setCartSubTotal, setIsGuest } from "@/redux/slices/cartSlice"
import { useDispatch } from 'react-redux'
import { useRouter } from 'next/navigation'
import { toast } from 'react-toastify'
import { LogOut, Loader2 } from 'lucide-react'
import useZoneHref from "@/hooks/useZoneHref";
import useDir from "@/hooks/useDir";

const LogoutModal = ({ showLogout, setShowLogout }) => {
  const zoneHref = useZoneHref();
    const router = useRouter();
    const dispatch = useDispatch();
    const theme = useSelector(state => state.Theme.theme)
    const language = useSelector(state => state.Language.selectedLanguage)
    const dir = useDir()
    // Sent to the logout API so the backend unregisters THIS device from push.
    const fcmToken = useSelector(state => state.User?.fcm_token)
    const [loading, setLoading] = useState(false)

    const handleHideLogout = () => {
        setShowLogout(false)
    }

    // Clear all local auth/cart state and leave the page. Runs regardless of the
    // server logout result — an expired token returns 401 and must still log the
    // user out client-side rather than leaving a stale persisted session.
    const clearLocalSession = () => {
        dispatch(clearAllFilter())
        dispatch(logoutAuth())
        dispatch(setJWTToken({ data: "" }))
        dispatch(setCurrentUser({ data: null }))
        dispatch(setCart({ data: [] }))
        dispatch(setCartProducts({ data: [] }))
        dispatch(setCartSubTotal({ data: 0 }))
        dispatch(clearCartPromo())
        dispatch(setIsGuest({ data: true }))
        setShowLogout(false)
        router.push(zoneHref("/"))
    }

    const handleLogout = async () => {
        setLoading(true)
        try {
            const response = await api.logout({ fcm: fcmToken });
            clearLocalSession()
            if (response?.status == 1) {
                toast.success(response.message)
            }
        } catch (error) {
            console.log("Error", error)
            // Best-effort: still log out locally even if the server call failed.
            clearLocalSession()
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={showLogout} onOpenChange={(open) => !open && !loading && handleHideLogout()}>
            <DialogOverlay className={`${theme == "light" ? "bg-black/40" : "bg-black/70"} backdrop-blur-sm`} />
            <DialogContent className="max-w-sm rounded-2xl p-6" title={t("logout_title")}>
                <div dir={dir} className="flex flex-col items-center text-center">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/15">
                        <LogOut className="h-6 w-6 text-red-600" />
                    </div>

                    <h1 className="mt-4 text-lg font-bold text-foreground">{t("logout_title")}</h1>
                    <p className="mt-1.5 text-sm text-muted-foreground">{t("logout_message")}</p>

                    <div className="mt-6 flex w-full gap-3">
                        <button
                            type="button"
                            disabled={loading}
                            onClick={handleHideLogout}
                            className="flex-1 rounded-lg border border-border bg-transparent px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                        >
                            {t("cancel")}
                        </button>
                        <button
                            type="button"
                            disabled={loading}
                            onClick={handleLogout}
                            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-60"
                        >
                            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                            {t("Ok")}
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export default LogoutModal
