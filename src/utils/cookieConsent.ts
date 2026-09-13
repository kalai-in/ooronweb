// Single source of truth for the visitor's cookie choice, shared by the banner
// that writes it and the analytics scripts that read it.
//
// Versioned key: bumping to `.v2` re-prompts everyone, which is what a material
// change to the cookie policy requires.
export const CONSENT_KEY = "cookie_consent.v1";

export const CONSENT_ACCEPTED = "accepted";
export const CONSENT_DECLINED = "declined";

// Fired on the window when the choice changes, so scripts can react in the same
// page view instead of waiting for a reload. The native `storage` event only
// fires in OTHER tabs, never the one that called setItem — hence a custom event.
export const CONSENT_EVENT = "cookieconsentchange";

/**
 * The stored choice, or null when the visitor hasn't answered yet.
 * Always null on the server: localStorage doesn't exist there, and callers must
 * treat "no answer" as "no consent".
 */
export const readConsent = (): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(CONSENT_KEY);
  } catch {
    // Storage blocked (private mode). Unknown answer → treat as not consented.
    return null;
  }
};

export const hasAcceptedCookies = (): boolean =>
  readConsent() === CONSENT_ACCEPTED;

/**
 * Persist the choice and notify listeners in this tab.
 */
export const writeConsent = (
  answer: typeof CONSENT_ACCEPTED | typeof CONSENT_DECLINED,
): void => {
  try {
    localStorage.setItem(CONSENT_KEY, answer);
  } catch {
    /* ignore storage errors — the in-memory notification below still fires */
  }
  try {
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: answer }));
  } catch {
    /* CustomEvent unavailable — nothing else to do */
  }
};
