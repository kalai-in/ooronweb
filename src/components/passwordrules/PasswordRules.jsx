"use client";
import { FiCheck, FiX } from "react-icons/fi";
import { usePasswordRules } from "@/utils/passwordValidation";

/**
 * Live checklist of the password policy from the settings API
 * (`web_settings.password_*`), one row per ACTIVE rule, ticking green as the
 * typed value satisfies each.
 *
 * Renders nothing until the user types: an untouched field showing a column of
 * red crosses reads as errors the user caused rather than as guidance.
 *
 * Only shown where a password is being SET (register, forgot-password reset,
 * profile reset) — never on login, where an existing password predating the
 * current policy must still be enterable.
 */
const PasswordRules = ({ password = "", className = "" }) => {
  // Hook first, bail after — an early return above it would make the hook call
  // conditional and break the rules of hooks the moment the field goes empty.
  const rules = usePasswordRules(password);
  if (!password || !rules.length) return null;

  return (
    <ul className={`mt-1.5 flex flex-col gap-1 ${className}`}>
      {rules.map((rule) => (
        <li
          key={rule.key}
          className={`flex items-center gap-1.5 text-xs ${
            rule.passed ? "text-green-600" : "text-gray-500 dark:text-zinc-400"
          }`}
        >
          {rule.passed ? (
            <FiCheck size={13} className="shrink-0" />
          ) : (
            <FiX size={13} className="shrink-0 text-gray-400" />
          )}
          <span>{rule.label}</span>
        </li>
      ))}
    </ul>
  );
};

export default PasswordRules;
