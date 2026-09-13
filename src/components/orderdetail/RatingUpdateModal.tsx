import React, { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { IoIosCloseCircle } from "react-icons/io";
import { RiCloseFill, RiStarSmileLine } from "react-icons/ri";
import { t } from "@/utils/translation";
import { TbCameraPlus } from "react-icons/tb";
import * as api from "@/api/apiRoutes";
import { toast } from "react-toastify";
import { MdStar } from "react-icons/md";
import Image from "next/image";

interface RatingUpdateModalProps {
  showUpdateRating: boolean;
  setShowUpdateRating: (show: boolean) => void;
  ratingId: number | string | null | undefined;
  handleFetchOrderDetail: () => Promise<void> | void;
}

const RatingUpdateModal = ({
  showUpdateRating,
  setShowUpdateRating,
  ratingId,
  handleFetchOrderDetail,
}: RatingUpdateModalProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState<string | null>(null);
  // Rating images/API responses have no shared type yet — see AGENTS.md rule 4.
  const [oldRatingImages, setOldRatingImages] = useState<any[]>([]);
  const [newRatingImages, setNewRatingImages] = useState<File[]>([]);
  const [deletedImages, setDeletedImages] = useState<any[]>([]);

  const handleIconClick = () => {
    fileInputRef.current?.click();
  };

  const handleFetchRating = async () => {
    try {
      const response = await api.getProductRating({ ratingId: ratingId });
      if (response?.status == 1) {
        setRating(response?.data?.rate);
        setReview(response?.data?.review);
        setOldRatingImages(response?.data?.images);
      } else {
        console.log("Error", response.message);
      }
    } catch (error) {
      console.log("Error", error);
    }
  };

  useEffect(() => {
    if (showUpdateRating) {
      if (buttonRef.current) {
        buttonRef.current.disabled = false;
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches rating data when modal opens
      handleFetchRating();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleFetchRating is a plain closure, re-run only on showUpdateRating change
  }, [showUpdateRating]);

  const deletePrevImage = (image: any) => {
    setDeletedImages((prevState) => [...prevState, image?.id]);
    const remainOldImages = oldRatingImages?.filter(
      (img) => img?.id != image?.id,
    );
    setOldRatingImages(remainOldImages);
  };

  const allowedImageTypes = [
    "image/jpeg",
    "image/png",
    "image/jpg",
    "image/gif",
    "image/svg+xml",
  ];

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const validFiles: File[] = [];
    files.forEach((file) => {
      if (allowedImageTypes.includes(file.type)) {
        validFiles.push(file);
      } else {
        toast.error(t("invalid_image_type"));
      }
    });
    setNewRatingImages((prevImages) => [...prevImages, ...validFiles]);
    event.target.value = "";
  };

  const removeImage = (index: number) => {
    setNewRatingImages((prevImages) =>
      prevImages.filter((_, idx) => idx !== index),
    );
  };

  const handleHideUpdateRatingModal = () => {
    setShowUpdateRating(false);
  };

  const handleUpdateRating = async () => {
    try {
      if (buttonRef.current) {
        buttonRef.current.disabled = true;
      }
      const response = await api.updateReviewProduct({
        ratingId: ratingId,
        rating: rating,
        review: review,
        deleteImages: deletedImages,
        images: newRatingImages,
      });
      if (response.status == 1) {
        toast.success(response.message);
        setRating(null);
        setReview(null);
        setDeletedImages([]);
        setNewRatingImages([]);
        setShowUpdateRating(false);
        await handleFetchOrderDetail();
      } else {
        toast.error(response.message);
        if (buttonRef.current) buttonRef.current.disabled = false;
      }
    } catch (error) {
      console.log("error", error);
      if (buttonRef.current) buttonRef.current.disabled = false;
    }
  };

  const ratingLabels = [
    t("rating_poor") || "Poor",
    t("rating_fair") || "Fair",
    t("rating_good") || "Good",
    t("rating_very_good") || "Very good",
    t("rating_excellent") || "Excellent",
  ];
  const activeStars = hoverRating || rating || 0;
  const MAX = 500;

  return (
    <Dialog open={showUpdateRating} onOpenChange={setShowUpdateRating}>
      <DialogContent
        className="p-0 gap-0 rounded-2xl border-0 sm:max-w-[440px] flex flex-col max-h-[90dvh] overflow-hidden"
        title={t("update_rating")}
      >
        {/* Hero header — soft primary wash, centered icon + title */}
        <div className="relative px-6 pb-5 pt-7 text-center">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(180deg, color-mix(in srgb, var(--primary-color) 12%, transparent), transparent)",
            }}
          />
          <button
            type="button"
            onClick={handleHideUpdateRatingModal}
            aria-label={t("close")}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/5 text-gray-500 transition hover:bg-black/10 dark:bg-white/10 dark:text-zinc-300"
          >
            <RiCloseFill size={20} />
          </button>
          <div className="relative mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl primaryBackColor text-white shadow-lg shadow-[var(--primary-color)]/30">
            <RiStarSmileLine size={26} />
          </div>
          <h2 className="relative text-lg font-extrabold textColor">
            {t("update_rating")}
          </h2>
          <p className="relative mt-1 text-xs SecondaryTextColor">
            {t("rate_this_product_now")}
          </p>
        </div>

        {/* Scrollable body */}
        <div className="flex flex-col gap-5 px-6 pb-2 overflow-y-auto overscroll-contain flex-1 custom-scrollbar">
          {/* Star picker — centered, hover-aware, with a label */}
          <div className="flex flex-col items-center gap-1.5 rounded-xl border cardBorder py-4">
            <div className="flex gap-1.5">
              {Array.from({ length: 5 }).map((_, idx) => (
                <button
                  type="button"
                  key={idx}
                  aria-label={`${idx + 1}`}
                  onClick={() => setRating(idx + 1)}
                  onMouseEnter={() => setHoverRating(idx + 1)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="transition-transform hover:scale-110 active:scale-95"
                >
                  <MdStar
                    size={36}
                    className={
                      idx < activeStars
                        ? "text-amber-400 drop-shadow-sm"
                        : "text-gray-300 dark:text-zinc-600"
                    }
                  />
                </button>
              ))}
            </div>
            <span className="text-xs font-semibold primaryColor dark:text-white h-4">
              {activeStars > 0 ? ratingLabels[activeStars - 1] : ""}
            </span>
          </div>

          {/* Review */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="product-review"
              className="text-sm font-semibold textColor"
            >
              {t("product_review")}
            </label>
            <div className="relative">
              <textarea
                id="product-review"
                rows={4}
                maxLength={MAX}
                value={review || ""}
                onChange={(e) => setReview(e.target.value)}
                placeholder={t("write_review_here")}
                className="w-full resize-none rounded-xl border cardBorder bg-transparent p-3 pb-7 text-sm leading-relaxed outline-none transition focus:primaryColorBorder focus:ring-2 focus:ring-[color-mix(in_srgb,var(--primary-color)_25%,transparent)]"
              />
              <span className="pointer-events-none absolute bottom-2.5 right-3 text-[11px] SecondaryTextColor">
                {(review || "").length}/{MAX}
              </span>
            </div>
          </div>

          {/* Photos */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-semibold textColor">
              {t("add_photos") || t("photos") || "Photos"}
            </label>
            <div className="flex flex-wrap gap-2.5">
              {oldRatingImages?.map((image, index) => (
                <div key={`old-${index}`} className="relative h-20 w-20">
                  <Image
                    height={200}
                    width={200}
                    src={image?.image_url}
                    alt={`Preview ${index + 1}`}
                    className="h-20 w-20 rounded-xl object-cover ring-1 ring-black/[0.06] dark:ring-white/[0.08]"
                  />
                  <button
                    type="button"
                    onClick={() => deletePrevImage(image)}
                    className="absolute -right-2 -top-2 text-red-500"
                  >
                    <IoIosCloseCircle size={24} />
                  </button>
                </div>
              ))}
              {newRatingImages?.map((src, index) => (
                <div key={`new-${index}`} className="relative h-20 w-20">
                  <Image
                    height={200}
                    width={200}
                    src={URL.createObjectURL(src)}
                    alt={`Preview ${index + 1}`}
                    className="h-20 w-20 rounded-xl object-cover ring-1 ring-black/[0.06] dark:ring-white/[0.08]"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute -right-2 -top-2 text-red-500"
                  >
                    <IoIosCloseCircle size={24} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={handleIconClick}
                className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-xl border border-dashed cardBorder text-gray-400 transition hover:primaryColorBorder hover:primaryColor"
              >
                <input
                  type="file"
                  multiple
                  hidden
                  accept="image/jpeg,image/png,image/jpg,image/gif,image/svg+xml"
                  name="image-upload"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                />
                <TbCameraPlus size={22} />
                <span className="text-[10px] font-medium">
                  {t("add") || "Add"}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* Sticky footer */}
        <div className="flex items-center gap-3 px-6 pb-6 pt-4">
          <button
            type="button"
            onClick={handleHideUpdateRatingModal}
            className="cardBorder textColor flex-1 rounded-xl border py-2.5 text-sm font-semibold transition hover:bg-gray-50 dark:hover:bg-zinc-800"
          >
            {t("cancel")}
          </button>
          <button
            type="button"
            onClick={handleUpdateRating}
            ref={buttonRef}
            className="primaryBackColor flex-[1.4] rounded-xl py-2.5 text-sm font-bold text-white shadow-md transition hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-gray-400 disabled:shadow-none"
          >
            {t("submit")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RatingUpdateModal;
