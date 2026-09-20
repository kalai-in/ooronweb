import React, { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import {
  RiUpload2Line,
  RiFilePdf2Line,
  RiCloseFill,
  RiFileList3Line,
  RiCheckLine,
} from "react-icons/ri";
import { t } from "@/utils/translation";
import { setPrescription, removePrescription } from "@/redux/slices/cartSlice";
import LightBox from "@/components/ui/LightBox";

// Accept images + PDF only, capped at 5 MB.
const MAX_PRESCRIPTION_BYTES = 5 * 1024 * 1024;
const isValidType = (file: File) =>
  file?.type?.startsWith("image/") || file?.type === "application/pdf";

interface PrescriptionUploadProps {
  // product variant id (map key)
  variantId: string | number;
  // is_prescription_required (1 = required)
  isRequired: number | string | undefined;
  // tighter layout for the drawer surfaces
  compact?: boolean;
  // render as a single tight unit that drops into the qty-stepper row (badge
  // folded in)
  inline?: boolean;
}

/**
 * Per-item prescription upload for medical products (product_type 5). Reads/writes
 * the redux prescriptions map (keyed by variantId). Accepts one image or PDF,
 * previews it, and shows a required/optional badge. Enforcement (blocking order
 * placement when a required Rx is missing) lives at the placement call sites via
 * getMissingRequiredPrescriptions — this component only collects the file.
 */
const PrescriptionUpload = ({
  variantId,
  isRequired,
  compact = false,
  inline = false,
}: PrescriptionUploadProps) => {
  const dispatch = useDispatch();
  const inputRef = useRef<HTMLInputElement>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const key = String(variantId);
  const stored = useSelector((s: any) => s.Cart.prescriptions?.[key]);
  // Guard: redux-persist rehydrates any pre-blacklist persisted File as a plain
  // {} (non-Blob), which would crash createObjectURL. Only treat real Blobs as a
  // valid uploaded file. Runtime value is always a File (set from an <input
  // type="file"> selection in handleChange below); the instanceof check is
  // against Blob only as a broader runtime guard, so the narrower File type is
  // applied here to match actual usage (.name) without changing behavior.
  const file: File | null =
    typeof Blob !== "undefined" && stored instanceof Blob ? (stored as File) : null;
  const required = Number(isRequired) === 1;

  const isImage = file?.type?.startsWith("image/");
  // Object URL for previewing the file (image OR pdf) — used for the thumbnail and
  // the "view" action. Recreated per file, revoked on cleanup.
  const previewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  );
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handlePick = () => inputRef.current?.click();

  // View the uploaded prescription: images open in the in-app lightbox; PDFs open
  // in a new browser tab (the image lightbox can't render them).
  const handleView = () => {
    if (!previewUrl) return;
    if (isImage) {
      setViewOpen(true);
    } else {
      window.open(previewUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    // reset input so re-picking the same filename fires change again
    e.target.value = "";
    if (!picked) return;
    if (!isValidType(picked)) {
      toast.error(t("invalid_prescription_type") || "Only image or PDF allowed");
      return;
    }
    if (picked.size > MAX_PRESCRIPTION_BYTES) {
      toast.error(t("prescription_too_large") || "File too large (max 5MB)");
      return;
    }
    dispatch(setPrescription({ variantId, file: picked }));
  };

  const handleRemove = () => dispatch(removePrescription({ variantId }));

  // Image preview lightbox (shared component). PDFs open in a new tab instead
  // (handled in handleView), so only images render a lightbox here.
  const lightbox =
    file && previewUrl && isImage ? (
      <LightBox
        showLightBox={viewOpen}
        setShowLightbox={setViewOpen}
        images={[{ src: previewUrl }]}
        imageIndex={0}
      />
    ) : null;

  // Inline: one tight control for the qty-stepper row. Uploaded → thumb + remove;
  // empty → a single Rx-upload pill (red when required, primary when optional).
  if (inline) {
    return (
      <>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={handleChange}
        />
        {file ? (
          /* Uploaded — minimal one-line text link below qty (no box, no tile):
             ✓ filename  ✕ */
          <span className="order-last flex w-full basis-full items-center gap-1.5 text-xs">
            <RiCheckLine size={14} className="shrink-0 primaryColor" />
            {/* filename → click to view the uploaded prescription in the lightbox */}
            <button
              type="button"
              onClick={handleView}
              title={t("view_prescription") || "View prescription"}
              className="min-w-0 max-w-[200px] truncate font-medium primaryColor hover:underline"
            >
              {file.name}
            </button>
            <button
              type="button"
              onClick={handleRemove}
              aria-label={t("remove_prescription") || "Remove"}
              className="shrink-0 text-gray-400 transition-colors hover:text-red-500"
            >
              <RiCloseFill size={15} />
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={handlePick}
            title={
              required
                ? t("prescription_required") || "Prescription required"
                : t("prescription_optional") || "Prescription (optional)"
            }
            className={`inline-flex h-8 items-center gap-1.5 rounded-lg border border-dashed px-2.5 text-[11px] font-bold transition-colors ${
              required
                ? "border-red-300 bg-red-50 text-red-600 hover:bg-red-100 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-400"
                : "primaryColorBorder primaryColor hover:primaryLightBack"
            }`}
          >
            <RiUpload2Line size={13} className="shrink-0" />
            {required
              ? t("upload_prescription_required") || "Upload Prescription"
              : t("upload_prescription") || "Upload Prescription"}
          </button>
        )}
        {lightbox}
      </>
    );
  }

  return (
    <div className={compact ? "mt-1.5" : "mt-2"}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={handleChange}
      />

      {file ? (
        /* Uploaded — preview chip: thumbnail/pdf icon + name (click to view) + remove. */
        <div className="flex items-center gap-2 rounded-lg border cardBorder bodyBackgroundColor p-1.5">
          <button
            type="button"
            onClick={handleView}
            title={t("view_prescription") || "View prescription"}
            className="flex min-w-0 flex-grow items-center gap-2 text-left"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-md primaryLightBack primaryColor">
              {isImage && previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt={file.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <RiFilePdf2Line size={18} />
              )}
            </span>
            <span className="min-w-0 flex-grow truncate text-xs font-medium textColor hover:underline">
              {file.name}
            </span>
          </button>
          <button
            type="button"
            onClick={handleRemove}
            aria-label={t("remove_prescription") || "Remove"}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-500/10"
          >
            <RiCloseFill size={15} />
          </button>
        </div>
      ) : (
        /* Empty — badge (required/optional) + upload button. */
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold ${
              required
                ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400"
                : "primaryLightBack primaryColor"
            }`}
          >
            <RiFileList3Line size={13} className="shrink-0" />
            {required
              ? t("prescription_required") || "Prescription required"
              : t("prescription_optional") || "Prescription (optional)"}
          </span>
          <button
            type="button"
            onClick={handlePick}
            className="inline-flex items-center gap-1.5 rounded-md border border-dashed primaryColorBorder px-2.5 py-1 text-[11px] font-bold primaryColor transition-colors hover:primaryLightBack"
          >
            <RiUpload2Line size={13} className="shrink-0" />
            {t("upload_prescription") || "Upload Prescription"}
          </button>
        </div>
      )}
      {lightbox}
    </div>
  );
};

export default PrescriptionUpload;
