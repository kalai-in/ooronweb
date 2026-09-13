import { t } from '@/utils/translation'
import React, { useState } from 'react'
import { FiLock, FiEye, FiEyeOff, FiShield, FiCheck } from 'react-icons/fi'
import * as api from "@/api/apiRoutes"
import { toast } from 'react-toastify'
import useDir from '@/hooks/useDir'
import PasswordRules from '../passwordrules/PasswordRules'
import { useValidatePassword } from '@/utils/passwordValidation'

/**
 * Change-password form. Mirrors the Profile card's shell (tinted hero header,
 * uppercase field labels, icon-led inputs, primary CTA) so the two profile
 * pages read as one surface rather than two different apps.
 *
 * Two presentations, ONE implementation — the standalone /profile/resetpassword
 * page and the modal launched from the profile card render this same component,
 * so the validation and submit path can't drift between them.
 */
interface ResetPasswordProps {
  // drop the card chrome (border/shadow/rounding) — the modal supplies its own container
  embedded?: boolean;
  // called after a successful change (modal closes)
  onSuccess?: () => void;
  // renders a Cancel button beside the CTA
  onCancel?: () => void;
}

const ResetPassword = ({ embedded = false, onSuccess, onCancel }: ResetPasswordProps) => {
    const dir = useDir();
    const [showPassword, setShowPassword] = useState(false)
    const [showNewPassword, setShowNewPassword] = useState(false)
    const [showConfirmPassword, setShowConfirmPassword] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    // "" not null: a null value makes the input uncontrolled on first render,
    // which React warns about and which breaks the reset-to-empty after submit.
    const [password, setPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    // First unmet rule from web_settings.password_*, or null. Derived rather than
    // stored so it re-evaluates on every keystroke without a second state update.
    const newPasswordPolicyError = useValidatePassword(newPassword);

    // Inline mismatch feedback, but only once the user has typed enough of the
    // confirmation to mean it — flagging on the first keystroke reads as an error
    // the user caused rather than as guidance.
    const mismatch =
        confirmPassword.length > 0 && newPassword !== confirmPassword;
    const confirmed =
        confirmPassword.length > 0 && newPassword === confirmPassword;

    const canSubmit =
        !!password &&
        !!newPassword &&
        !newPasswordPolicyError &&
        newPassword === confirmPassword &&
        !submitting;

    const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (submitting) return;
        try {
            if (!password) {
                toast.error(t("please_enter_current_password") || "Please enter your current password")
                return
            }
            if (!newPassword) {
                toast.error(t("please_enter_new_password"))
                return
            }
            else if (newPasswordPolicyError) {
                // Length/complexity rules come from web_settings.password_* — the old
                // hardcoded `length < 6` is now just one of the configured rules.
                toast.error(newPasswordPolicyError)
                return
            }
            else if (newPassword !== confirmPassword) {
                toast.error(t("confirm_password_message"))
                return
            }
            setSubmitting(true)
            const res = await api.resetPassword({ password: password, newPassword: newPassword, confirmPassword: confirmPassword })
            if (res.status == 1) {
                toast.success(res.message)
                setPassword("")
                setConfirmPassword("")
                setNewPassword("")
                onSuccess?.()
            } else {
                toast.error(res.message)
            }
        } catch (error) {
            console.log("error", error)
        } finally {
            setSubmitting(false)
        }
    }

    const inputClass = (hasError: boolean | undefined) =>
        `block w-full rounded-xl border py-2.5 ps-10 pe-11 text-sm outline-none transition-all duration-200 placeholder:text-gray-400 text-start bg-gray-50/70 dark:bg-zinc-800/60 textColor ${hasError
            ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-500/20"
            : "cardBorder focus:primaryColorBorder focus:ring-2 focus:ring-[var(--primary-color,#29363f)]/15"
        }`;

    // One field = label + lock icon + reveal toggle. The toggle is a real
    // <button type="button"> so it's keyboard-reachable and can never submit the
    // form — the old <div> was neither.
    interface FieldProps {
        id: string;
        label: string;
        value: string;
        onChange: (value: string) => void;
        placeholder: string;
        show: boolean;
        setShow: (show: boolean) => void;
        hasError?: boolean;
        children?: React.ReactNode;
    }

    const field = ({ id, label, value, onChange, placeholder, show, setShow, hasError, children }: FieldProps) => (
        <div className="flex flex-col gap-1.5">
            <label
                htmlFor={id}
                className="text-xs font-semibold uppercase tracking-wider text-gray-500"
            >
                {label} <span className="text-red-500">*</span>
            </label>
            <div className="relative flex items-center w-full">
                <span className="absolute start-3.5 text-gray-400 pointer-events-none">
                    <FiLock size={16} />
                </span>
                <input
                    type={show ? "text" : "password"}
                    id={id}
                    name={id}
                    autoComplete={id === "current-password" ? "current-password" : "new-password"}
                    placeholder={placeholder}
                    className={inputClass(hasError)}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                />
                <button
                    type="button"
                    onClick={() => setShow(!show)}
                    aria-label={show ? t("hide") || "Hide password" : t("show") || "Show password"}
                    className="absolute end-3 text-gray-400 hover:textColor transition-colors"
                >
                    {show ? <FiEyeOff size={16} /> : <FiEye size={16} />}
                </button>
            </div>
            {children}
        </div>
    );

    return (
        <div
            dir={dir}
            className={
                embedded
                    ? "w-full"
                    : "w-full mx-auto h-fit cardBorder bg-white dark:bg-zinc-900 rounded-2xl shadow-sm"
            }
        >
            <form onSubmit={handleResetPassword} className="w-full flex flex-col">
                {/* Hero header — same soft primary tint as the Profile card. The
                    modal renders its own title, so it's suppressed there. */}
                {!embedded && (
                    <div className="px-6 py-5 rounded-t-2xl bg-[color-mix(in_srgb,var(--primary-color,#29363f)_7%,transparent)]">
                        <h2 className="text-lg font-bold textColor">{t("resetPassword")}</h2>
                        <p className="text-xs subTextColor mt-0.5">
                            {t("choose_a_strong_password") ||
                                "Choose a strong password you don't use elsewhere"}
                        </p>
                    </div>
                )}

                <div className={embedded ? "" : "p-6"}>
                    {/* Constrained column: full-width password fields on a wide
                        desktop card look unmoored and hurt scannability. */}
                    <div className={`flex flex-col gap-5 ${embedded ? "" : "max-w-md"}`}>
                        {!embedded && (
                            <div className="flex items-center gap-2 pb-2 border-b border-gray-100 dark:border-zinc-800">
                                <span className="flex h-7 w-7 items-center justify-center rounded-lg primaryColor bg-[color-mix(in_srgb,var(--primary-color,#29363f)_10%,transparent)]">
                                    <FiShield size={15} />
                                </span>
                                <h4 className="font-bold text-sm textColor">
                                    {t("change_password")}
                                </h4>
                            </div>
                        )}

                        {field({
                            id: "current-password",
                            label: t("password"),
                            value: password,
                            onChange: setPassword,
                            placeholder: t("please_enter_password"),
                            show: showPassword,
                            setShow: setShowPassword,
                        })}

                        {field({
                            id: "new-password",
                            label: t("newPassword"),
                            value: newPassword,
                            onChange: setNewPassword,
                            placeholder: t("please_enter_new_password"),
                            show: showNewPassword,
                            setShow: setShowNewPassword,
                            children: <PasswordRules password={newPassword} />,
                        })}

                        {field({
                            id: "confirm-password",
                            label: t("confirmPassword"),
                            value: confirmPassword,
                            onChange: setConfirmPassword,
                            placeholder: t("please_enter_confirm_password"),
                            show: showConfirmPassword,
                            setShow: setShowConfirmPassword,
                            hasError: mismatch,
                            children: mismatch ? (
                                <p className="text-xs text-red-500">
                                    {t("confirm_password_message")}
                                </p>
                            ) : confirmed ? (
                                <p className="flex items-center gap-1.5 text-xs text-green-600">
                                    <FiCheck size={13} className="shrink-0" />
                                    {t("passwords_match") || "Passwords match"}
                                </p>
                            ) : null,
                        })}

                        <div className="flex justify-end gap-3 pt-1">
                            {onCancel && (
                                <button
                                    type="button"
                                    onClick={onCancel}
                                    disabled={submitting}
                                    className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-white/15 text-sm font-semibold text-gray-700 dark:text-gray-200 transition hover:bg-gray-50 dark:hover:bg-white/5 disabled:opacity-50"
                                >
                                    {t("cancel")}
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={!canSubmit}
                                className="px-6 py-2.5 primaryBackColor hover:opacity-90 text-white rounded-xl font-semibold text-sm shadow-sm transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {submitting
                                    ? t("saving")
                                    : t("change_password")}
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </div>
    )
}

export default ResetPassword;
