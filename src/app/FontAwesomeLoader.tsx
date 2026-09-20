"use client";

/**
 * FontAwesome: only for API-driven social icons (arbitrary fa-* classes),
 * which all render below the fold in the header/footer/sidebar.
 *
 * Loaded NON-BLOCKING: as a cross-origin stylesheet in <head> it would sit on
 * the critical path and delay first paint (Lighthouse "Render-blocking
 * requests"). The media="print" + onLoad swap is the standard trick — the
 * browser fetches it at low priority without blocking render, then flips it
 * to media="all" once it arrives. <noscript> keeps the icons working with JS
 * disabled.
 *
 * A Client Component (not inline in the Server Component root layout)
 * because next/document's string-form `onLoad="this.media='all'"` handler
 * isn't valid JSX — App Router event handlers must be real functions, which
 * only a Client Component can attach.
 */
export default function FontAwesomeLoader() {
  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css"
        media="print"
        onLoad={(e) => {
          const link = e.currentTarget;
          link.media = "all";
          link.onload = null;
        }}
      />
      <noscript>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css"
          media="all"
        />
      </noscript>
    </>
  );
}
