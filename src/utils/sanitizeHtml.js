import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitize API/CMS-provided HTML before injecting it via
 * dangerouslySetInnerHTML. Strips <script>, event handlers, javascript:
 * URLs, etc. — blocks stored XSS if the admin/API content is compromised.
 *
 * Returns an object ready to spread into dangerouslySetInnerHTML:
 *   <div dangerouslySetInnerHTML={sanitizeHtml(apiHtml)} />
 */
export const sanitizeHtml = (dirty) => ({
  __html: DOMPurify.sanitize(dirty ?? "", { USE_PROFILES: { html: true } }),
});

export default sanitizeHtml;
