import type { Dispatch, SetStateAction } from "react";
import { LuTriangleAlert } from "react-icons/lu";
import { Dialog, DialogContent, DialogOverlay } from "@/components/ui/dialog";
import { t } from "@/utils/translation";
import { useSelector } from "react-redux";
import * as api from "@/api/apiRoutes";
import { clearAllFilter } from "@/redux/slices/productFilterSlice";
import {
  logoutAuth,
  setJWTToken,
  setCurrentUser,
} from "@/redux/slices/userSlice";
import {
  setCart,
  setCartProducts,
  setCartSubTotal,
  setIsGuest,
} from "@/redux/slices/cartSlice";
import { useDispatch } from "react-redux";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import useZoneHref from "@/hooks/useZoneHref";

interface DeleteModalProps {
  showDelete: boolean;
  setShowDelete: Dispatch<SetStateAction<boolean>>;
}

const DeleteModal = ({ showDelete, setShowDelete }: DeleteModalProps) => {
  const zoneHref = useZoneHref();
  const router = useRouter();
  const dispatch = useDispatch();
  const user = useSelector((state: any) => state.User);
  const theme = useSelector((state: any) => state.Theme.theme);

  const handleHideDelete = () => {
    setShowDelete(false);
  };

  const handleDelete = async () => {
    try {
      const response = await api.deleteUser({ uid: user?.authId });
      if (response.status == 1) {
        if (user?.authType == "phone" || user?.authType == "google") {
          // const user = auth.currentUser;
          try {
            // const res = await user.delete();
            dispatch(clearAllFilter());
            dispatch(logoutAuth());
            dispatch(setJWTToken({ data: "" }));
            dispatch(setCurrentUser({ data: null }));
            dispatch(setCart({ data: [] }));
            dispatch(setCartProducts({ data: [] }));
            dispatch(setCartSubTotal({ data: 0 }));
            dispatch(setCartProducts({ data: [] }));
            dispatch(setIsGuest({ data: true }));
            router.push(zoneHref("/"));
            setShowDelete(false);
            toast.success(response.message);
          } catch (error) {
            console.log("error", error);
          }
        } else {
          dispatch(clearAllFilter());
          dispatch(logoutAuth());
          dispatch(setJWTToken({ data: "" }));
          dispatch(setCurrentUser({ data: null }));
          dispatch(setCart({ data: [] }));
          dispatch(setCartProducts({ data: [] }));
          dispatch(setCartSubTotal({ data: 0 }));
          dispatch(setCartProducts({ data: [] }));
          dispatch(setIsGuest({ data: true }));
          router.push(zoneHref("/"));
          setShowDelete(false);
          toast.success(response.message);
        }
      } else {
        toast.error(response.message);
      }
    } catch (error) {
      console.log("Error", error);
    }
  };

  return (
    <Dialog open={showDelete}>
      <DialogOverlay
        className={`${theme == "light" ? "bg-white/80" : "bg-black/80"}`}
      />
      <DialogContent className="max-w-sm rounded-2xl p-0 overflow-hidden" title={t("delete")}>
        <div className="flex flex-col items-center px-6 pt-8 pb-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-500/15">
            <LuTriangleAlert size={28} className="text-red-600 dark:text-red-400" />
          </div>
          <h2 className="mt-4 text-lg font-bold text-gray-900 dark:text-gray-100">
            {t("delete")}
          </h2>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
            {t("delete_user_message")}
          </p>
          <div className="mt-6 flex w-full gap-3">
            <button
              className="flex-1 rounded-xl border border-gray-200 dark:border-white/15 px-4 py-2.5 text-sm font-semibold text-gray-700 dark:text-gray-200 transition hover:bg-gray-50 dark:hover:bg-white/5"
              onClick={handleHideDelete}
            >
              {t("cancel")}
            </button>
            <button
              className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 active:scale-[0.98]"
              onClick={handleDelete}
            >
              {t("Ok")}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteModal;
