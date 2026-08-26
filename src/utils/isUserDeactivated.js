// Pure predicate — deliberately kept free of store/translation imports so the
// axios layer can use it without pulling redux slices into a circular import.
//
// The backend reports a deactivated account with status:1 — the SUCCESS status —
// distinguishing it only by `status_code: "USER_DEACTIVATED"`. Callers therefore
// cannot rely on `status` alone; a login response must be run through this check
// before being treated as successful, otherwise a deactivated user gets a
// session with an undefined access_token.
//
// Shapes seen from the backend across versions:
//   status_code: "USER_DEACTIVATED"     (current)
//   message: "User is deactivated"      (current, human text)
//   message: "user_deactivated"         (older, key-style)
const normalize = (v) =>
  String(v || "")
    .trim()
    .toLowerCase()
    .replace(/[\s.]+/g, "_");

export const isUserDeactivated = (res) => {
  if (!res || typeof res !== "object") return false;
  const code = normalize(res?.status_code);
  const message = normalize(res?.message);
  return (
    code === "user_deactivated" ||
    // Covers the human-text and key-style phrasings ("User is deactivated",
    // "user_deactivated", "your account is de-activated", …).
    /deactivated|de_activated/.test(message)
  );
};

// True when a user object fetched from the backend represents a deactivated
// account. The customer API marks an active account with status 1; a deactivated
// one flips to 0 (some endpoints send "0" as a string).
export const isDeactivatedUser = (user) => {
  if (!user) return false;
  const status = user?.status;
  if (status === undefined || status === null || status === "") return false;
  return Number(status) === 0;
};
