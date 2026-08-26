# Documentation

Setup, deployment, and configuration guides for the Web Portal storefront.

**New here? Start with the [Overview](OVERVIEW.md).**

## Guides

| Guide | Read it when |
| --- | --- |
| [Overview](OVERVIEW.md) | Understanding what the project is and how it fits with the Admin Panel |
| [Installation Steps](INSTALLATION.md) | Setting up for the first time — prerequisites, `.env`, first build |
| [Firebase Setup](FIREBASE_SETUP.md) | Push notifications — project, VAPID key, service worker, verification |
| [File Structure](FILE_STRUCTURE.md) | Finding your way around the codebase |
| [Configuration & Theming](CONFIGURATION.md) | Colours, home page blocks, channels, zones, languages |
| [Deployment Guide (VPS)](DEPLOYMENT_VPS.md) | Going live with SEO enabled — Node 20, PM2, Apache/Nginx |

## Reference

- [Project Overview](PROJECT_OVERVIEW.md)
- [URL Structure](url-structure.md)
- [Zone SEO](zone-seo.md)
- [Language SEO](language-seo.md)
- [Map & Location System](MAP_LOCATION_SYSTEM.md)

## Quick start

```bash
npm install
# create .env in the project root — see INSTALLATION.md for every variable
npm run dev             # http://localhost:3000
```

Production:

```bash
npm run build
npm start               # NODE_ENV=production, port 8004, via server.js
```
