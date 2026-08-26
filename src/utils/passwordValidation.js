import { useSelector } from "react-redux";
import { store } from "@/redux/store";
import { t } from "@/utils/translation";

// The settings API sends every password rule as a STRING, and uses "0" for
// "rule off" — including max length, where "0" means "no upper bound" rather
// than "zero characters allowed". Everything below normalises through here so a
// "0" can never be mistaken for a real limit.
const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const toFlag = (value) => toNumber(value) > 0;

const DEFAULT_MIN = 6;

// The password rules sit on the settings payload's TOP level, alongside
// app_name/support_email — NOT inside web_settings, where most themeable
// fields live. web_settings is still checked as a fallback in case a build
// moves them there.
const readRule = (setting, key) =>
  setting?.[key] ?? setting?.web_settings?.[key];

const normalizePolicy = (setting) => ({
  min: toNumber(readRule(setting, "password_min_length")) || DEFAULT_MIN,
  max: toNumber(readRule(setting, "password_max_length")), // 0 = no maximum
  requireUppercase: toFlag(readRule(setting, "password_require_uppercase")),
  requireLowercase: toFlag(readRule(setting, "password_require_lowercase")),
  requireNumber: toFlag(readRule(setting, "password_require_number")),
  requireSpecial: toFlag(readRule(setting, "password_require_special")),
});

/**
 * Password policy from the settings API (`web_settings.password_*`), read
 * imperatively from the store.
 *
 * NOT reactive — a component that calls this renders once against whatever the
 * store held at that moment and never re-renders when the settings arrive,
 * which showed up as the checklist being stuck on the fallback rules. Inside
 * components use `usePasswordPolicy()` / `usePasswordRules()` below; this form
 * is for submit handlers and other non-render code, which run after the fact.
 *
 * `max: 0` means unbounded. `min` falls back to 6 — the length the forms
 * hardcoded before this existed — so a settings payload without the field keeps
 * today's behaviour instead of accepting a one-character password.
 */
export const getPasswordPolicy = () =>
  normalizePolicy(store.getState()?.Setting?.setting);

/** Reactive policy — re-renders the caller when the settings land. */
export const usePasswordPolicy = () => {
  const setting = useSelector((state) => state.Setting?.setting);
  return normalizePolicy(setting);
};

// t() has no interpolation, so {min}/{max} in en.json are filled here.
const fill = (key, values) =>
  Object.entries(values).reduce(
    (str, [k, v]) => str?.replace(`{${k}}`, v),
    t(key),
  );

/**
 * The active rules as a checklist, each with its own pass/fail against the
 * current value. Drives the live checklist under the field; only the rules the
 * settings actually enable are returned, so a permissive policy renders a short
 * list rather than a wall of greyed-out requirements.
 *
 * `policy` is injectable so a component can pass the reactive one from
 * `usePasswordPolicy()`; omitted, it falls back to a one-shot store read.
 */
export const getPasswordRules = (password = "", policyArg = null) => {
  const policy = policyArg ?? getPasswordPolicy();
  const value = String(password ?? "");
  const rules = [];

  rules.push({
    key: "min",
    label:
      policy.max > 0
        ? fill("password_rule_length_range", {
            min: policy.min,
            max: policy.max,
          })
        : fill("password_rule_min_length", { min: policy.min }),
    // The range rule owns both bounds, so it must fail on an over-long password
    // too — otherwise a too-long value shows every rule ticked and still fails.
    passed:
      value.length >= policy.min &&
      (policy.max === 0 || value.length <= policy.max),
  });

  if (policy.requireUppercase) {
    rules.push({
      key: "uppercase",
      label: t("password_rule_uppercase"),
      passed: /[A-Z]/.test(value),
    });
  }
  if (policy.requireLowercase) {
    rules.push({
      key: "lowercase",
      label: t("password_rule_lowercase"),
      passed: /[a-z]/.test(value),
    });
  }
  if (policy.requireNumber) {
    rules.push({
      key: "number",
      label: t("password_rule_number"),
      passed: /\d/.test(value),
    });
  }
  if (policy.requireSpecial) {
    rules.push({
      key: "special",
      label: t("password_rule_special"),
      // Anything that is not a letter, digit or whitespace counts — matching the
      // usual server-side definition rather than a curated symbol list.
      passed: /[^A-Za-z0-9\s]/.test(value),
    });
  }

  return rules;
};

/**
 * First unmet rule as a display message, or null when the password satisfies
 * the whole policy. Forms gate their submit on this.
 *
 * An EMPTY password returns null: "required" is a separate concern each form
 * already handles, and a policy error against an untouched field reads as
 * broken.
 */
export const validatePassword = (password, policy = null) => {
  if (!password) return null;
  const failed = getPasswordRules(password, policy).find((rule) => !rule.passed);
  return failed ? failed.label : null;
};

/** True when the password is present AND satisfies every active rule. */
export const isPasswordValid = (password, policy = null) =>
  !!password && !validatePassword(password, policy);

/**
 * Reactive counterparts for use inside components — these subscribe to the
 * settings, so the checklist and the gate both update the moment the policy
 * arrives instead of freezing on the fallback rules.
 */
export const usePasswordRules = (password = "") =>
  getPasswordRules(password, usePasswordPolicy());

export const useValidatePassword = (password) =>
  validatePassword(password, usePasswordPolicy());
