# Deployment Guide (VPS)

This guide deploys the storefront to a VPS with **SEO enabled** — a real Node
server behind Apache, not a static export.

> **Why a VPS.** With `NEXT_PUBLIC_SEO=true` the app server-renders every page,
> generates `sitemap.xml` on request, emits per-page meta tags, and runs
> `src/middleware.js` — which is what makes zone URLs (`/bhuj-quick/...`) and
> language URLs (`/ur/...`) resolve at all. All of that needs a running Node
> process, which shared hosting cannot provide.
>
> **A VPS is required.** Setting `NEXT_PUBLIC_SEO=false` to fit shared hosting
> is not a supported fallback: the static export silently drops middleware, so
> every zone- and language-prefixed URL 404s. See
> [OVERVIEW.md](OVERVIEW.md#two-decisions-that-shape-everything).

Complete [INSTALLATION.md](INSTALLATION.md) first — this guide assumes a working
`.env` and a successful local `npm run build`.

## Prerequisites

- A VPS you can SSH into (this guide assumes Debian/Ubuntu and `apt`; substitute
  your distro's package manager otherwise).
- A domain or subdomain pointed at the server.
- An SSL certificate — Firebase push notifications and geolocation both require
  HTTPS.
- Apache with `mod_rewrite` and `mod_proxy` enabled, or Nginx (config below).

## Step 1 — Upload the project

Upload the project folder to the server with FileZilla, `scp`, or `git clone`.

Exclude `node_modules/` and `.next/` — both are rebuilt on the server.

```bash
# from your machine
rsync -av --exclude node_modules --exclude .next \
  ./ user@your-server:/var/www/storefront/
```

## Step 2 — Install Node.js 20 via NVM

NVM lets you run several Node versions side by side.

```bash
sudo apt update
sudo apt install -y curl
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash

# reload the shell so `nvm` is on PATH
source ~/.bashrc

nvm install 20
nvm use 20
nvm alias default 20
```

Verify:

```bash
node -v    # v20.x
npm -v
```

## Step 3 — Install PM2

PM2 keeps the Node process alive and restarts it after a crash or reboot.

```bash
npm install pm2 -g
pm2 -v
```

## Step 4 — Choose a port

The project ships configured for port **8004** (see `package.json`). Check that
it is free:

```bash
sudo lsof -i -P -n | grep 8004
```

- **No output** → the port is free, use it.
- **Output** → another process owns it. Pick a different port (8000–8010 are
  common) and change it in **both** places below.

To change the port, edit the `start` script in `package.json`:

```json
"start": "NODE_ENV=production NODE_PORT=8004 node server.js"
```

`server.js` reads `NODE_PORT` and falls back to 3000 if it is unset.

## Step 5 — Configure the environment

On the server, make sure `.env` holds the **production** values:

```env
NEXT_PUBLIC_SEO=true
NEXT_PUBLIC_API_URL=https://your-admin-panel-domain.com
NEXT_PUBLIC_API_SUBURL=/customer
NEXT_PUBLIC_BASE_URL=https://your-storefront-domain.com
```

`NEXT_PUBLIC_BASE_URL` must be the real public domain — canonical tags and
`sitemap.xml` are generated from it.

> `.env` values are inlined at **build time**. Changing `.env` after a build has
> no effect until you rebuild and restart. This trips people up constantly.

## Step 6 — Install and build

```bash
cd /var/www/storefront
npm install
npm run build
```

`npm run build` writes the server build to `.next/`. Do **not** run
`npm run export` — that produces the static, non-SEO output.

## Step 7 — Start with PM2

```bash
pm2 start "npm start" -n "storefront"
pm2 ls
```

`pm2 ls` shows either:

- **online** — good, continue.
- **errored** / restart loop — run `pm2 logs storefront` and read the error
  before going further.

Make PM2 survive a reboot:

```bash
pm2 startup      # prints a command — copy and run it
pm2 save
```

Useful commands:

```bash
pm2 logs storefront      # tail logs
pm2 restart storefront   # restart after a rebuild
pm2 stop storefront
pm2 delete storefront
```

## Step 8 — Proxy the web server to Node

The Node process listens on `127.0.0.1:8004`; the web server forwards public
traffic to it.

### Apache

The repository already contains a working `.htaccess` at the project root. Place
it in your domain's document root, and change `8004` if you chose another port:

```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /

    RewriteRule ^/.well-known/acme-challenge/(.*) /.well-known/acme-challenge/$1 [L]

    RewriteRule ^index.html http://127.0.0.1:8004/$1 [P]
    RewriteRule ^index.php http://127.0.0.1:8004/$1 [P]
    RewriteRule ^/?(.*)$ http://127.0.0.1:8004/$1 [P]
</IfModule>
```

Enable the required modules:

```bash
sudo a2enmod rewrite proxy proxy_http
sudo systemctl restart apache2
```

> **Do not** add a rule mapping `^_next/` to the filesystem. `/_next/static/*`
> are real files, but `/_next/data/*` and `/_next/image` are **server routes**
> with no file behind them — mapping them to disk returns a 404 HTML page
> instead of JSON, which breaks client-side navigation. Proxy everything to Node
> and let Next.js serve its own static assets; it already sends immutable cache
> headers, so each chunk is fetched once.
>
> The `.well-known` rule is kept first so Let's Encrypt renewals work. `server.js`
> also serves `/.well-known` directly for domain-verification files.

### Nginx

```nginx
server {
    listen 443 ssl;
    server_name your-storefront-domain.com;

    ssl_certificate     /etc/letsencrypt/live/your-domain/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain/privkey.pem;

    location / {
        proxy_pass         http://127.0.0.1:8004;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

server {
    listen 80;
    server_name your-storefront-domain.com;
    return 301 https://$host$request_uri;
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## Step 9 — Verify SEO output

SEO is the reason for this deployment style, so confirm it actually works.
Run these from your own machine, not the server:

```bash
# 1. Server-rendered HTML — should contain real product markup, not an empty div
curl -s https://your-storefront-domain.com/ | grep -i "<title>"

# 2. Sitemap — should return XML with your URLs
curl -s https://your-storefront-domain.com/sitemap.xml | head -20

# 3. Robots
curl -s https://your-storefront-domain.com/robots.txt
```

Then check in a browser:

- **View Source** (not DevTools Inspect) on a product page — the product name,
  price, and description must be present in the raw HTML. If you only see an
  empty `<div id="__next">`, the app is running a static export: check
  `NEXT_PUBLIC_SEO`, rebuild, and restart PM2.
- Canonical tag points at `NEXT_PUBLIC_BASE_URL`, not `localhost`.
- Submit the sitemap in Google Search Console.

## Updating a deployed site

```bash
cd /var/www/storefront
git pull                  # or upload the new files
npm install               # only if dependencies changed
npm run build
pm2 restart storefront
```

Always rebuild before restarting — PM2 serves whatever is in `.next/`.

## Troubleshooting

### 502 Bad Gateway

Node is not running or is on a different port.

```bash
pm2 ls
pm2 logs storefront
sudo lsof -i -P -n | grep 8004
```

Confirm the port in `.htaccess`/Nginx matches `NODE_PORT` in `package.json`.

### Blank white page

Open DevTools → Console. Common causes:

- `NEXT_PUBLIC_API_URL` unreachable from the server.
- CORS not configured on the Admin Panel for your storefront domain.
- A stale `.next/` from a previous export build — delete it and rebuild:

  ```bash
  rm -rf .next && npm run build && pm2 restart storefront
  ```

### Pages render but client navigation 404s

A `_next` rewrite is mapping to the filesystem. Remove it — see the warning in
Step 8.

### Environment changes have no effect

`.env` is read at build time. Rebuild and restart:

```bash
npm run build && pm2 restart storefront
```

### PM2 does not come back after reboot

```bash
pm2 startup    # run the command it prints
pm2 save
```

### Push notifications work locally but not in production

Firebase web push requires HTTPS with a valid certificate, and
`public/firebase-messaging-sw.js` must be served from the same origin as the app.
Confirm the worker is registered under DevTools → Application → Service Workers.
