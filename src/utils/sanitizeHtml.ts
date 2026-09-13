import sanitize from "sanitize-html";

// isomorphic-dompurify (previous implementation) sanitizes server-side via
// jsdom, which crashes on Vercel's serverless runtime with an ESM/CJS
// require() error — it never surfaced while these pages were bailing to
// client-only rendering (see the CSR-bailout fix, 2026-08-25), but now that
// SSR actually runs, every dangerouslySetInnerHTML call site using this util
// hit it. sanitize-html is pure string parsing (no DOM/jsdom dependency),
// so it works the same on server and client and on any runtime.
//
// Widened past sanitize-html's defaults: <img> (product/CMS descriptions
// embed images) plus class/style on the common tags admin-authored HTML
// actually uses, so this doesn't strip formatting DOMPurify's html profile
// allowed. <script>/event handlers/javascript: URLs are still never allowed
// — that's the XSS protection this exists for.
//
// `style` is constrained to an explicit property allowlist (allowedStyles
// below), NOT just allowlisted as an attribute name: unlike DOMPurify,
// sanitize-html does not parse/sanitize CSS *values* — allowlisting the bare
// `style` attribute would pass e.g. `style="background:url(javascript:...)"`
// or `style="width:expression(alert(1))"` straight through unmodified. Every
// property here is a plain value pattern (no url()), so there's no CSS-value
// injection surface even though the attribute itself is allowed.
const ALLOWED_TAGS = [...sanitize.defaults.allowedTags, "img"];
const ALLOWED_ATTRIBUTES = {
  ...sanitize.defaults.allowedAttributes,
  "*": ["class", "style"],
  // data: is on top of the defaults (http/https/ftp/mailto/tel) so inline
  // base64 images survive — common output from paste-an-image-into-the-CMS
  // editor flows, and the whole reason `img` was added above.
  img: [...(sanitize.defaults.allowedAttributes.img ?? []), "class", "style"],
};
const ALLOWED_SCHEMES_BY_TAG = { img: [...sanitize.defaults.allowedSchemes, "data"] };
const ALLOWED_STYLES = {
  "*": {
    color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i, /^[a-z]+$/i],
    "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i, /^[a-z]+$/i],
    "text-align": [/^(left|right|center|justify)$/],
    "font-size": [/^\d+(\.\d+)?(px|em|rem|%)$/],
    "font-weight": [/^(normal|bold|\d{3})$/],
    "font-style": [/^(normal|italic)$/],
    "text-decoration": [/^(none|underline|line-through)$/],
    width: [/^\d+(\.\d+)?(px|em|rem|%)$/],
    height: [/^\d+(\.\d+)?(px|em|rem|%)$/],
  },
};

/**
 * Sanitize API/CMS-provided HTML before injecting it via
 * dangerouslySetInnerHTML. Strips <script>, event handlers, javascript:
 * URLs, etc. — blocks stored XSS if the admin/API content is compromised.
 *
 * Returns an object ready to spread into dangerouslySetInnerHTML:
 *   <div dangerouslySetInnerHTML={sanitizeHtml(apiHtml)} />
 */
export const sanitizeHtml = (dirty: string | null | undefined): { __html: string } => ({
  __html: sanitize(dirty ?? "", {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemesByTag: ALLOWED_SCHEMES_BY_TAG,
    allowedStyles: ALLOWED_STYLES,
  }),
});

export default sanitizeHtml;
