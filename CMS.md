# Youngness CMS — Phase 1 (Foundation)

This converts the workshop site from a **hardcoded config file** to a **database-driven CMS**
so the client edits content from a browser instead of touching code.

Phase 1 delivers the foundation the rest of the spec builds on:

- **MongoDB** (Atlas) as the content store — none existed before.
- **Admin auth** — email + password, bcrypt hashing, JWT sessions, protected routes.
- **SiteConfig API** — the full website content served from the DB (`GET /api/site-config`)
  and editable by the admin (`PUT /api/site-config`).
- **Migration** — a script that imports every value from `config/workshop-config.js` into the DB
  and verifies a byte-for-byte round-trip (see the report below).
- **Public site wired to the API** — the landing page + thank-you page now fetch content from the
  CMS, with the old config file kept **only as an offline fallback** so the site can never render blank.
- **Admin panel (React + Vite)** — login, dashboard, and a content editor (guided fields + full JSON)
  with autosave and dark mode.

The live **registration + Razorpay + Google Sheets** flow is untouched.

---

## 1. Folder structure

```
youngness-workshop/
├── backend/                     # Express API (Render)
│   ├── config/index.js          # env → config (added: mongoUri, jwt, admin)
│   ├── db/connect.js            # ★ Mongoose connection
│   ├── models/
│   │   ├── SiteConfig.js        # ★ full website content (singleton doc)
│   │   └── User.js              # ★ admin users (bcrypt)
│   ├── controllers/
│   │   ├── authController.js    # ★ login / me / logout
│   │   ├── siteConfigController.js  # ★ get (public) / update (admin)
│   │   ├── registrationController.js   # (unchanged)
│   │   ├── orderController.js          # (unchanged)
│   │   └── paymentController.js        # (unchanged)
│   ├── middleware/
│   │   ├── auth.js              # ★ JWT verify + role guard
│   │   ├── rateLimit.js         # ★ login / write / read limiters
│   │   ├── validate.js · logger.js · errorHandler.js   # (unchanged)
│   ├── routes/
│   │   ├── authRoutes.js        # ★ /api/auth/*
│   │   ├── contentRoutes.js     # ★ /api/site-config
│   │   └── paymentRoutes.js     # (unchanged)
│   ├── scripts/
│   │   ├── seedAdmin.js         # ★ create/reset the first admin
│   │   ├── migrateConfig.js     # ★ import config file → DB (+ report)
│   │   └── migration-report.json# ★ generated proof of migration
│   ├── services/                # razorpayService · sheetService (unchanged)
│   ├── app.js                   # + helmet, + /api routes
│   └── server.js                # + DB connect on boot
│
├── frontend/                    # Public site (Hostinger) — source
│   ├── js/config.js             # ★ now fetches /api/site-config (fallback = file)
│   ├── js/app.js                # ★ async boot: await loadConfig() then render
│   ├── thank-you.html           # ★ fetches from CMS (fallback = file)
│   ├── config/workshop-config.js# kept as OFFLINE FALLBACK only
│   └── … (sections, css, assets — unchanged)
│
├── frontend-production/         # Deploy copy of the public site (synced)
│
└── admin/                       # ★ Admin panel (React + Vite) — new app
    ├── index.html · vite.config.js · package.json · .env.example
    └── src/
        ├── main.jsx · App.jsx · styles.css
        ├── lib/{api.js, auth.jsx}
        ├── components/{Layout.jsx, ui.jsx}
        └── pages/{Login.jsx, Dashboard.jsx, Content.jsx}
```

★ = added or changed in Phase 1.

---

## 2. Database schema

**`users`**

| field | type | notes |
|---|---|---|
| email | String | unique, lowercased, indexed |
| name | String | |
| passwordHash | String | bcrypt, `select:false` (never returned) |
| role | String | `admin` \| `editor` |
| active | Boolean | |
| lastLoginAt | Date | |
| timestamps | | createdAt / updatedAt |

**`siteconfigs`** (singleton — one active document)

| field | type | notes |
|---|---|---|
| key | String | unique, always `"default"` |
| data | Mixed | the full nested content object (same shape as the old config file) |
| updatedBy | ObjectId → User | audit |
| version | Number | bumped on every save |
| timestamps | | createdAt / updatedAt |

> **Why one document now:** the public site already consumes one nested config object, so storing that
> exact shape lets the frontend switch from a file to the API with zero UI risk. **Phase 2** splits the
> hot collections — `Trainer`, `Testimonial`, `Faq`, `Module`, `Benefit`, `Feature`, `Registration`,
> `Media`, `PaymentSettings`, `SeoSettings`, `GoogleSettings` — into their own models with per-item CRUD.
> No secrets are stored in `data` (only values already shipped to the browser).

---

## 3. API endpoints

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/health` | — | health check (Render) |
| POST | `/api/auth/login` | — | email+password → JWT (rate-limited) |
| GET | `/api/auth/me` | Bearer | restore session |
| POST | `/api/auth/logout` | — | client drops token |
| GET | `/api/site-config` | — | full website content (public site reads this) |
| PUT | `/api/site-config` | Bearer (admin/editor) | save website content |
| POST | `/register` | — | (unchanged) save pending registration |
| POST | `/create-order` | — | (unchanged) Razorpay order |
| POST | `/verify-payment` | — | (unchanged) verify signature → mark paid |

Auth is a **Bearer JWT** in the `Authorization` header (not cookies), so CSRF does not apply to the
API surface. Security: `helmet`, CORS allow-list, `express-rate-limit`, input validation, bcrypt,
role-based guard, and the Razorpay **secret + sheet token stay server-side only**.

---

## 4. Admin credentials setup

```bash
cd backend
cp .env.example .env         # then fill in MONGODB_URI, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, …
npm install
npm run seed:admin           # creates the first admin from ADMIN_EMAIL / ADMIN_PASSWORD
npm run migrate:config       # imports config/workshop-config.js → DB (prints the report)
npm start                    # or: npm run dev
```

`seed:admin` is safe to re-run — it resets the password to the current `ADMIN_PASSWORD` (handy if the
client forgets it). Then run the admin panel:

```bash
cd admin
cp .env.example .env          # set VITE_API_BASE to your backend URL (default http://localhost:4000)
npm install
npm run dev                   # http://localhost:5173  → log in with the seeded credentials
```

---

## 5. Deployment

### Backend → Render
1. **MongoDB Atlas**: create a free cluster, add a DB user, allow network access `0.0.0.0/0`
   (Render egress IPs are dynamic), copy the connection string.
2. **Render → New Web Service** from the repo, root `backend/`, build `npm install`, start `npm start`.
3. **Environment** (Render dashboard): `MONGODB_URI`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`,
   `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `GOOGLE_SHEET_ENDPOINT`, `SHEET_SHARED_TOKEN`,
   `FRONTEND_URL` (public site URL **and** admin URL, comma-separated), `NODE_ENV=production`.
4. One-time via Render Shell: `npm run seed:admin && npm run migrate:config`.

### Public site → Hostinger (unchanged process)
- `cd frontend && npm run build:css`, then upload `frontend-production/` (or `frontend/`) static files.
- Set `api.prod` (in `config/workshop-config.js`) to the Render URL — this is still used to resolve
  the API base **and** as the offline fallback content.

### Admin panel → Render Static Site (or Netlify/Vercel/Hostinger subdomain)
- Build command `npm install && npm run build`, publish directory `admin/dist`, root `admin/`.
- Env `VITE_API_BASE=https://<your-render-backend>`.
- Add a SPA rewrite (all paths → `/index.html`) and add the admin origin to the backend `FRONTEND_URL`.

---

## 6. Migration report

`npm run migrate:config` imports the file and **verifies the DB matches it exactly**
(`backend/scripts/migration-report.json`):

```
Top-level sections : 25
Total values       : 347
Round-trip verified: ✓ PASS — DB matches the file exactly
```

Per-section value counts: brand 3 · workshop 8 · api 2 · integrations 3 · payment 38 · seo 6 ·
ctaNote 1 · marquee 2 · header 1 · hero 22 · testimonials 23 · problem 11 · modules 26 ·
whyDifferent 20 · audience 18 · choice 11 · trainer 13 · bonus 22 · guarantee 7 · faq 12 ·
finalCta 6 · footer 13 · sticky 3 · popup 3 · registration 73.

Every one of these values now lives in MongoDB and is served by `GET /api/site-config`. The public
site renders from that response; the old file remains solely as a safety fallback.

---

## Verified in Phase 1

- Migration round-trips 347 values across 25 sections — **PASS**.
- `seed:admin` creates the admin; login rejects wrong passwords (401) and issues a JWT on success.
- `PUT /api/site-config` without a token → **401**; with a token it persists and `GET` reflects it.
- Admin app builds cleanly (Vite, 41 modules).
- Public `config.js`/`app.js` fetch the API and fall back to the bundled file if it's unreachable.

## Phase 2+ roadmap (from the full brief)

Split content into dedicated models with per-item CRUD + drag-reorder (Trainers, Modules, FAQ,
Testimonials, Benefits, Features); **Registrations** in the DB with search / filter / CSV+Excel export /
status editing; **Analytics** with charts; **Media Manager** on Cloudinary; dedicated Payment / Google
Sheets / SEO settings screens; and admin niceties (pagination, confirmation dialogs, more autosave).
```
