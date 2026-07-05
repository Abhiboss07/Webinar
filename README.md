# Youngness Workshop — CMS & Event-Management Platform

A production-grade, **database-driven CMS** for running healthcare workshops end-to-end: website content,
media, workshops, a registration CRM, payments, communication automation, attendance & QR check-in,
certificates, analytics, RBAC users, settings, and system administration — **all managed from a browser**,
no config-file editing required.

## Parts

| Folder | What | Deploys to |
|---|---|---|
| **`backend/`** | Node/Express API + CMS + workers (MongoDB) | Render (or Docker) |
| **`admin/`** | React/Vite admin panel (the CMS) | Render Static / Netlify / nginx |
| **`frontend/`** | Public workshop landing site (static, Tailwind) | Hostinger / any static host |
| **`docs/`** | `CMS.md` (architecture + every module), `DEPLOYMENT.md` (deploy + ops) | — |
| `google-apps-script.gs` | Google Sheets data-layer script the client deploys to Apps Script | Google |

## Content is CMS-driven

The website content, workshops, pricing, branding, SEO, integrations (Razorpay/Cloudinary/SMTP/Sheets) and
everything else are stored in MongoDB and edited in the **admin panel** — the client never edits code.
`frontend/config/workshop-config.js` remains only as a **bootstrap + offline fallback** (it supplies the API
URL and lets the public page still render if the API is briefly unreachable); it is **not** the source of
truth for content.

## Quick start (local, Docker)

```bash
cp backend/.env.example backend/.env      # set MONGODB_URI, JWT_SECRET, ADMIN_* …
docker compose up --build                 # API :4000 · admin :8080 · mongo :27017
docker compose exec backend npm run seed:admin
docker compose exec backend sh -c "npm run migrate:config && npm run seed:workshop && npm run seed:templates"
```

Or run each part directly — see **[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)** for local dev, Render +
Hostinger deployment, the env matrix, one-time seed order, and the operations runbook.

## Security (highlights)

Bcrypt + JWT with refresh tokens, RBAC on every endpoint, account lockout, AES-256-GCM-encrypted settings
secrets (never returned to the browser), Helmet, gzip compression, global + per-route rate limiting, query
sanitization, and a full audit log. A registration is only marked **Paid** after a **backend-verified**
Razorpay signature — the frontend result is never trusted; the amount is server-owned.

## Architecture & module details

See **[`docs/CMS.md`](docs/CMS.md)** — it documents every phase (foundation → production release), the
database schema, all API endpoints, and per-module testing.
