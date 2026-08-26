import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        {/* Preconnectors */}
        <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossorigin />

        {/* Instrument Sans is self-hosted via next/font in _app.js — no Google
            Fonts CDN needed (no render-blocking link, no unused families). */}

        {/* FontAwesome: only for API-driven social icons (arbitrary fa-* classes),
            which all render below the fold in the header/footer/sidebar.
            Loaded once (was duplicated: preload + stylesheet).

            Loaded NON-BLOCKING: as a cross-origin stylesheet in <head> it sat on
            the critical path and delayed first paint (Lighthouse "Render-blocking
            requests"). The media="print" + onLoad swap is the standard trick —
            the browser fetches it at low priority without blocking render, then
            flips it to media="all" once it arrives. <noscript> keeps the icons
            working with JS disabled. */}
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css"
          media="print"
          onLoad="this.media='all';this.onload=null;"
        />
        <noscript>
          <link
            rel="stylesheet"
            href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css"
            media="all"
          />
        </noscript>
        {/* <script
          async
          defer
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_MAP_API}&libraries=places&loading=async`}
        ></script> */}
       
      </Head>
      <body className="antialiased !pointer-events-auto">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
