const fs = require('fs');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || '';
const API_URL = process.env.NEXT_PUBLIC_API_URL || '';
const API_SUBURL = process.env.NEXT_PUBLIC_API_SUBURL || '';
const API_BASE = `${API_URL}${API_SUBURL}`;
// Client access key + a default channel/coords so the location-scoped product
// listing endpoint responds during the build. Mirrors src/api/axiosMiddleware.
const ACCESS_KEY = '';
const DEFAULT_CHANNEL = '';
const DEFAULT_LAT = process.env.SITEMAP_LAT || '';
const DEFAULT_LNG = process.env.SITEMAP_LNG || '';

// changefreq/priority per route type — a flat 1.0 on every URL is meaningless
// to crawlers. Dynamic detail pages rank below the listing/home pages.
const urlEntry = (loc, { changefreq = 'monthly', priority = '0.7' } = {}) => `  <url>
    <loc>${loc}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;

// Per-route hints for the static pages. Anything not listed defaults to
// weekly/0.5. Home gets top priority.
const ROUTE_HINTS = {
  '': { changefreq: 'daily', priority: '1.0' },
  products: { changefreq: 'daily', priority: '0.9' },
  categories: { changefreq: 'weekly', priority: '0.8' },
  brands: { changefreq: 'weekly', priority: '0.6' },
  blogs: { changefreq: 'weekly', priority: '0.6' },
  'about-us': { changefreq: 'yearly', priority: '0.4' },
  'contact-us': { changefreq: 'yearly', priority: '0.4' },
  'privacy-policy': { changefreq: 'yearly', priority: '0.3' },
  'terms-and-conditions': { changefreq: 'yearly', priority: '0.3' },
  'shipping-policy': { changefreq: 'yearly', priority: '0.3' },
  'cancellation-policy': { changefreq: 'yearly', priority: '0.3' },
  'return-and-exchange-policy': { changefreq: 'yearly', priority: '0.3' },
};

// Routes that exist as pages but must not be indexed (error page, cart/checkout
// funnel, payment callbacks, and the /product redirect stub).
const NON_INDEXABLE = new Set([
  '404',
  'cart',
  'checkout',
  'web-payment-status',
  'payment-status',
  'product', // redirect stub → /products
]);

// Fallback: enumerate static routes straight from the filesystem (the original
// behavior) so the sitemap never shrinks below what the pages already provide,
// even if the API is unreachable. Dynamic templates are dropped — we never emit
// a literal `product/[slug]` URL; real slugs come from the API below.
const staticRoutesFromPages = async () => {
  const { globby } = await import('globby');
  const pages = await globby([
    'src/pages/**/*{.js,.jsx,.ts,.tsx,.mdx}',
    '!src/pages/_*.js',
    '!src/pages/_*.jsx',
    '!src/pages/api',
    '!src/pages/**/\\[*',   // drop dynamic route segments like [slug], [orderid]
  ]);

  const routes = new Set();
  for (const page of pages) {
    let route = page
      .replace('src/pages/', '')
      .replace(/\.(js|jsx|ts|tsx|mdx)$/, '')
      .replace(/\/index$/, '')
      .replace(/^index$/, '');
    if (route.includes('[') || route.includes(']')) continue; // safety
    // profile/* pages are auth-gated, not indexable content — skip them.
    if (route.startsWith('profile')) continue;
    // Non-indexable routes: error page, cart/checkout funnel, payment
    // callbacks, and the /product redirect stub (real listing is /products).
    if (NON_INDEXABLE.has(route)) continue;
    routes.add(route);
  }
  return Array.from(routes);
};

const safeJson = async (res) => {
  try {
    return await res.json();
  } catch {
    return null;
  }
};

// Pull every page of `data[].slug` from a paginated endpoint. Returns [] on any
// failure so a flaky API never breaks the build — it just yields a smaller
// sitemap (logged), rather than a crash or literal-template URLs.
const fetchSlugs = async ({ label, url, method = 'GET', headers = {}, bodyBase = {} }) => {
  const slugs = [];
  const limit = 50;
  let offset = 0;
  try {
    for (let page = 0; page < 200; page++) {
      const params = new URLSearchParams({ ...bodyBase, limit: String(limit), offset: String(offset) });
      const opts = { method, headers };
      let reqUrl = url;
      if (method === 'GET') {
        reqUrl = `${url}?${params.toString()}`;
      } else {
        opts.headers = { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' };
        opts.body = params.toString();
      }
      const res = await fetch(reqUrl, opts);
      const json = await safeJson(res);
      const rows = json?.data;
      if (!Array.isArray(rows) || rows.length === 0) break;
      for (const r of rows) {
        if (r?.slug) slugs.push(r.slug);
      }
      if (rows.length < limit) break;
      offset += limit;
    }
  } catch (err) {
    console.warn(`[sitemap] ${label} enumeration failed:`, err.message);
  }
  console.log(`[sitemap] ${label}: ${slugs.length} slugs`);
  return slugs;
};

const generateSitemap = async () => {
  if (!BASE_URL) {
    console.warn('[sitemap] NEXT_PUBLIC_BASE_URL is empty — sitemap URLs will be malformed.');
  }

  const productHeaders = { 'x-access-key': ACCESS_KEY, channel: DEFAULT_CHANNEL };

  const [staticRoutes, categorySlugs, productSlugs, blogSlugs] = await Promise.all([
    staticRoutesFromPages(),
    fetchSlugs({ label: 'categories', url: `${API_BASE}/categories`, method: 'GET' }),
    fetchSlugs({
      label: 'products',
      url: `${API_BASE}/products`,
      method: 'POST',
      headers: productHeaders,
      bodyBase: { latitude: DEFAULT_LAT, longitude: DEFAULT_LNG },
    }),
    fetchSlugs({ label: 'blogs', url: `${API_BASE}/blogs`, method: 'GET' }),
  ]);

  const entries = [];

  for (const route of staticRoutes) {
    entries.push(urlEntry(`${BASE_URL}/${route}`, ROUTE_HINTS[route] || { changefreq: 'weekly', priority: '0.5' }));
  }
  for (const slug of categorySlugs) {
    entries.push(urlEntry(`${BASE_URL}/categories/${slug}`, { changefreq: 'weekly', priority: '0.7' }));
  }
  for (const slug of productSlugs) {
    entries.push(urlEntry(`${BASE_URL}/product/${slug}`, { changefreq: 'weekly', priority: '0.6' }));
  }
  for (const slug of blogSlugs) {
    entries.push(urlEntry(`${BASE_URL}/blog/${slug}`, { changefreq: 'monthly', priority: '0.5' }));
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>`;
  // src/pages/sitemap.xml.js serves a zone-aware sitemap on the server, and Next
  // refuses to build when a public/ file and a page claim the same path. So only
  // emit the static file for `output: "export"` builds (NEXT_PUBLIC_SEO=false),
  // where there is no server to run that route.
  if (process.env.NEXT_PUBLIC_SEO === 'false') {
    fs.writeFileSync('public/sitemap.xml', sitemap);
    console.log(`[sitemap] wrote public/sitemap.xml with ${entries.length} URLs (static:${staticRoutes.length} cat:${categorySlugs.length} prod:${productSlugs.length} blog:${blogSlugs.length})`);
  } else {
    console.log('[sitemap] skipped public/sitemap.xml — src/pages/sitemap.xml.js serves it (zone-aware)');
  }

  // robots.txt — was missing entirely (returned 404). Point crawlers at the
  // sitemap and allow indexing.
  const robots = `User-agent: *
Allow: /

Sitemap: ${BASE_URL}/sitemap.xml
`;
  fs.writeFileSync('public/robots.txt', robots);
  console.log('[sitemap] wrote public/robots.txt');

  // ---- Firebase messaging service worker (unchanged) ----
  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };
  const messagingTemplate = fs.readFileSync('./templates/firebase-messaging-template.js', 'utf-8');

  const messagingFile = messagingTemplate.replace(/FIREBASE_API_KEY/g, firebaseConfig.apiKey)
    .replace(/FIREBASE_AUTH_DOMAIN/g, firebaseConfig.authDomain)
    .replace(/FIREBASE_PROJECT_ID/g, firebaseConfig.projectId)
    .replace(/FIREBASE_STORAGE_BUCKET/g, firebaseConfig.storageBucket)
    .replace(/FIREBASE_MESSAGING_SENDER_ID/g, firebaseConfig.messagingSenderId)
    .replace(/FIREBASE_APP_ID/g, firebaseConfig.appId)
    .replace(/FIREBASE_MEASUREMENT_ID/g, firebaseConfig.measurementId);

  fs.writeFileSync('./public/firebase-messaging-sw.js', messagingFile);
};

generateSitemap();
