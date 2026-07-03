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
npm run seed:workshop        # creates the first active Workshop from that content (Module 2.4)
npm start                    # or: npm run dev
```

`seed:admin` also seeds the seven RBAC roles and makes the bootstrap account a **Super Admin**. It is
safe to re-run — it resets the password to the current `ADMIN_PASSWORD` (handy if the client forgets it).
Then run the admin panel:

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
4. One-time via Render Shell: `npm run seed:admin && npm run migrate:config && npm run seed:workshop`.

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

---

# Phase 2 (in progress)

Order (revised for early client value): **Dashboard → Homepage CMS → Media → Registration Manager →
Workshop Manager → Payments → Users → Settings.**

## Phase 2.1 — Dashboard ✅

Real analytics, backed by a new `Registration` collection that the live sign-up flow now
**dual-writes** to (Google Sheets stays the primary record; the Mongo mirror is best-effort and never
breaks the payment path).

**Data model — `registrations`:** `regId` (unique), contact + profile fields, `source`/`sourceHost`,
`paymentStatus` (Pending/Paid/Failed), `orderId`/`paymentId`/`paymentMethod`/`amount`/`currency`/
`transactionTime`, timestamps. Written by `services/registrationStore.js` from the existing
`/register` and `/verify-payment` controllers.

**API:** `GET /api/stats/dashboard?days=7|14|30|90` (admin) → cards (total / today / pending / paid /
failed / revenue), active workshop, charts (registrations-over-time, payment-status, source-breakdown),
and recent activity. Day buckets are computed in **IST** consistently across the window and the Mongo
grouping, so the time series always reconciles with the totals.

**Admin UI:** stat cards, three dependency-free SVG charts (validated palette, hover tooltips, direct
labels, legends), a recent-activity table, a 7/14/30/90-day range switch, skeleton loaders and empty
states, in both light and dark themes.

**Verified:** auth required (401 without token); card integrity (paid+pending+failed==total, revenue ==
Σ paid×price); `Σ(series) == count(in-window)`; dual-write captures a lead even when the Sheets write
fails; admin builds clean.

## Phase 2.2 — Homepage CMS ✅

Per-section control over the homepage, plus a proper **draft → preview → publish** workflow with
version history — all inside the existing `SiteConfig` model (no duplicate structures).

**Section manifest, not duplicated content:** `data.sections` is an ordered `[{key, enabled}]` list that
*references* the existing content keys. `backend/config/sections.js` is the canonical list of the 12 real
body sections (hero, testimonials, problem, modules, whyDifferent, audience, choice, trainer, bonus,
guarantee, faq, finalCta) with friendly labels; `normalizeManifest()` seeds/repairs it non-destructively.

**Draft / publish:** `data` = published (what the public serves), `draft` = the admin's working copy
(autosave target), `history` = capped snapshots for revert.

**API added:** `GET /api/site-config?preview=1` (draft for Preview), `GET /api/site-config/draft`,
`PUT /api/site-config` (now saves the **draft**), `POST /api/site-config/publish`,
`POST /api/site-config/discard`, `GET /api/site-config/history`, `POST /api/site-config/revert`.

**Public site:** `frontend/js/app.js` renders body sections in manifest order, honouring `enabled` and
the footer toggle, skipping any section with no renderer/content; `?preview=1` loads the draft. Missing
manifest → historical default order (fully backward compatible). Synced to `frontend-production`.

**Admin:** new **Homepage Sections** page (drag-and-drop reorder, enable/disable switches, footer toggle,
live "N of 12 enabled" validation); a shared **PublishBar** (autosave status, Preview, Discard, Publish,
Version history → Restore) driven by a `DraftProvider` that the Content editor now also uses.

**Database changes:** `siteconfigs` gains `draft`, `history[]` (capped 15), `publishedAt`,
`draftUpdatedAt`. No new collection.

**Verified (18/18 e2e assertions):** auth guards; manifest normalization (12 sections); draft isolation
(public shows published while preview shows draft); reorder + disable persist through publish; history
snapshot + `hasDraft` reset; validation 400s; discard restores published; revert restores an older
snapshot; frontend/backend section order confirmed identical.

**Known limitations:** section content is edited on the Content page (guided fields + JSON) — dedicated
per-item editors (add/edit/delete individual trainers, FAQs, modules) are a later slice; Preview needs
`VITE_PUBLIC_SITE_URL` set; charts/section UI still need a human eyeball in a browser (no browser in the
build environment).

## Phase 2.3 — Media Library ✅

A full Cloudinary-backed media manager behind a **provider abstraction**, so it also runs on local disk
in dev (no secrets needed) and Cloudinary drops in for production via env.

**Storage abstraction:** `services/storage/index.js` selects `cloudinaryAdapter` (prod) or `localAdapter`
(dev/fallback) from `STORAGE_PROVIDER`. Local files are served at `<API_URL>/uploads/…`; Cloudinary
returns CDN URLs with `f_auto,q_auto` optimisation and a 300×300 thumbnail transformation.

**Model — `media`:** provider, publicId, url/secureUrl/thumbUrl, resourceType (image/video/raw), format,
bytes, width/height, originalFilename, folder, altText, tags[], `checksum` (sha256 dedupe), uploadedBy.

**APIs added:** `GET /api/media` (search / type + folder filter / paginate, with live usage counts),
`POST /api/media` (multipart upload, dedupe), `GET /api/media/:id`, `PATCH /api/media/:id`
(alt/folder/tags), `POST /api/media/:id/replace` (swap file **and rewrite the URL everywhere it's used**
across published + draft), `DELETE /api/media/:id` (blocked with 409 if in use unless `?force=1`).
Static `/uploads` route for the local adapter.

**Admin:** Media Library page — drag-and-drop upload with per-file progress, **client-side image
optimisation** before upload, search/type/folder filters, grid with thumbnails + usage badges +
dimensions + size, an asset modal (preview, edit alt/folder/tags, copy URL, replace, delete),
pagination. A reusable **MediaField** now backs the Logo / Hero image / OG image fields in the Content
editor — pick from the library instead of pasting URLs. Existing string paths keep working.

**Database changes:** new `media` collection (indexes on publicId, checksum, resourceType, folder).

**Verified (24/24 e2e + static serve):** auth guard; upload with real dimension/size/checksum; **dedupe**
(same bytes → same asset); unsupported-type 400; pdf → raw; search + type/folder filters; **usage count**
from live content; patch; **replace propagates** the new URL into the draft; delete guard (409 → force);
`/uploads` serves the file (`200 image/png`); Cloudinary adapter rejects cleanly when unconfigured; admin
builds clean (49 modules).

**Known limitations:** local adapter does no server-side resize (Cloudinary does in prod; the admin still
downsizes large images client-side); Cloudinary paths need real credentials to exercise here; browser
eyeball of the grid/dropzone still pending (no browser in build env).

## Phase 2.4 — Workshop Manager ✅

Workshops become first-class, cloneable entities. A `Workshop.content` **overlays** the site-wide
`SiteConfig` base — the public `/api/site-config` composes `{ …base, …activeWorkshop.content }` (workshop
owns `workshop`, `hero`, `seo`, `registration`, `modules`, `faq`, `testimonials`, `trainer`, `bonus`,
`gallery`…), while brand/footer/section-manifest stay site-wide.

**Safety:** with no active workshop the endpoint returns today's output unchanged; the migration
(`seed:workshop`) creates one active workshop that mirrors the current content **exactly**, so the
composed output is byte-identical (verified). Overlay only replaces keys the workshop defines, so partial
workshops fall back to the base.

**Model — `workshops`:** title, subtitle, description, slug (unique), category, `status`
(draft/published/archived), `isActive` (one live workshop), `scheduledFor` (delayed go-live), `content`
(overlay), timestamps.

**APIs added:** `GET/POST /api/workshops`, `GET/PUT/DELETE /api/workshops/:id`,
`POST /api/workshops/:id/{duplicate,activate,status}`. Public `GET /api/site-config?workshop=<slug>`
previews any (even draft) workshop; the site forwards `?preview=1&workshop=` from the URL.

**Admin:** Workshops list (status/active badges, filters, New/Edit/Duplicate/Publish/Unpublish/Activate/
Archive/Restore/Delete/Preview) and a tabbed editor (General · Schedule · Registration · Media · SEO ·
Advanced JSON) with autosave, Media picker for banner/trainer/gallery.

**Database changes:** new `workshops` collection (indexes: slug, status, isActive). No changes to existing
collections; registration/payment/Sheets untouched.

**Verified (22/22 e2e):** auth guard; seeded active/published/live workshop; **composed == base
(byte-identical)**; draft preview via `?workshop=`; create/slug/validation; publish→activate switches the
live workshop and deactivates the old; duplicate; delete-active guard (409); archive → safe fallback;
reactivate; future-`scheduledFor` not served until its time; migration idempotent; admin builds (52 mod).

**Known limitations:** arrays (agenda/modules, faq, testimonials, certificates, sponsors) are edited via
the Advanced JSON tab for now — dedicated per-item editors come later; per-workshop draft-vs-published
dual copies aren't implemented (status + `?workshop=` preview cover the workflow); no cron for scheduled
publish (go-live is computed at read time, which is sufficient).

## Phase 2.5 — Registration Manager (CRM) ✅

A lightweight CRM over the `Registration` collection (already populated by the live dual-write). The public
sign-up + payment-verification write paths are **untouched** — this module only reads and curates.

**Model extended (backward-compatible):** `paymentStatus` enum +`Cancelled`/`Refunded`; new flags
`attended` / `certificateIssued` / `waitlisted`; `notes[]` (text/by/at) and an `activity[]` timeline;
indexes on `createdAt`, `workshop`, `profession`.

**APIs added (all admin):** `GET /api/registrations` (search across regId/name/email/phone/workshop/
profession · filters: status/workshop/profession/experience/method/date-range · sort · pagination),
`GET /stats`, `GET /facets`, `GET /:id`, `PATCH /:id` (status/flags → logged to activity),
`POST /:id/notes`, `DELETE /:id`, `POST /bulk` (status | delete),
`GET /export?format=csv|xlsx` (filtered **or** selected `ids`).

**Admin:** stat cards (total / today / paid / pending / revenue / conversion), a data grid with sticky
header, sortable columns, search + advanced filters, row selection with a bulk bar (set status / delete /
export selected), CSV + Excel export (real `.xlsx` via exceljs), pagination, skeletons + empty states, and
a details **drawer** (profile · workshop · payment · status controls · internal notes · activity timeline).

**Database changes:** extra fields + indexes on the existing `registrations` collection; no new collection.

**Verified (21/21 e2e):** auth guard; stats integrity (status counts sum to total; revenue/conversion);
pagination/total; search; status/profession/date filters; name sort; facets; detail; status patch logs
activity; flag toggle; notes with author; bulk status (3) + bulk delete (2); CSV export (mime + rows +
filename); **XLSX export is a valid zip** (PK) with the right mime; selected-rows export; and — crucially —
the public `/register` flow still lands in the CRM as *Pending*. Admin builds (57 modules).

**Known limitations:** offset pagination (not cursor) — fine at admin scale, gives page totals; no
virtual scrolling or resizable columns yet (pagination + sticky header cover it); QR attendance /
certificate generation / messaging are stubs for later modules.

## Phase 2.6 — Payment Manager ✅

A financial dashboard over the same `Registration` records (which already hold order/payment/amount/
method/status). Read + admin actions only — the public `verifyPayment`/Razorpay flow is untouched, and
**no secret ever appears in a response** (verified).

**Model:** +`refundId` / `refundAmount` / `refundedAt` on `registrations` (set only by the admin refund
action). `razorpayService.refundPayment()` added.

**APIs added (all admin; refund is admin-role only):** `GET /api/payments` (search + status/workshop/
method/amount-range/date filters + sort + pagination), `GET /stats` (revenue / today / successful /
pending / failed / refunded / avg-ticket / conversion), `GET /analytics` (revenue-by-day, revenue-by-
workshop, success%, refund%), `GET /:id`, `POST /:id/verify` (re-check against gateway → reconcile),
`POST /:id/status` (Paid/Failed override), `POST /:id/refund` (real gateway refund **or** manual),
`GET /:id/receipt` + `/:id/invoice` (PDF via pdfkit), `GET /export?format=csv|xlsx`.

**Admin:** Payments page — 8 financial stat cards, revenue-over-time + revenue-by-workshop charts, filters
(status/workshop/method/amount-range/date), payment table, CSV/Excel export, and a details **drawer**
(customer · payment · verification · activity) with actions: retry verification, mark paid/failed, refund
(gateway or manual, with confirm), download receipt/invoice, copy IDs.

**Database changes:** 3 refund fields on `registrations`. No new collection.

**Verified (21/21 e2e):** auth guard; stats (revenue/avg-ticket/conversion consistent); analytics (14-day
series, workshop split, success/refund rates); list + gateway tag; status/amount-range filters;
**no key-secret/signature/jwt in responses**; detail verified flag; manual refund → Refunded (+ guard that
non-Paid → 400); retry-verify without a payment id → 400; **receipt + invoice PDFs** (`%PDF`); CSV (payment
columns) + XLSX (valid zip) export. Admin builds (60 modules).

**Known limitations:** gateway refund + retry-verify against a *captured* payment need **live Razorpay
credentials** to exercise (logic implemented + guarded; tested via the manual/no-network paths); PDF export
of the whole list isn't built (per-payment receipt/invoice + CSV/XLSX cover it); offset (not cursor)
pagination.

## Phase 2.7 — User & Role Management (RBAC) ✅

A production-grade RBAC system. **Seeded roles preserve the previous access** (admin → full, editor →
content_editor), so nothing broke when permission checks were added across all modules (verified by
re-running the 2.2 and 2.6 suites).

**Roles & permissions:** 7 seeded system roles — Super Admin (bypass), Admin, Manager, Finance, Content
Editor, Support, Viewer — over 12 resources × 9 actions (view/create/edit/delete/publish/export/refund/
approve/manage_users). Super Admin can edit any role's matrix and create custom roles.

**Immediate effect:** `requireAuth` loads each user's *current* role + permissions from the DB per request
(8s role cache, cleared on role edits), so **role and permission changes apply to existing sessions
instantly** — and deactivating a user blocks their token immediately.

**Auth hardening:** access JWT + opaque **refresh tokens** (hashed, stored as `Session`s → session
list/revoke), Remember-Me (7d/30d), account **lock after 5 failed logins**, strong-password policy,
password change / forgot / reset (tokens generated; email delivery is Module 2.8), secure logout
(session revoke). Bearer-token auth (no cookies) ⇒ CSRF not applicable to the API.

**Audit log:** every security/data action (`login`, `login.failed`, `logout`, `user.*`, `role.*`,
`content.publish`, `workshop.publish`, `payment.refund`, `media.delete`, `registration.export`,
`password.*`) records user, IP, user-agent, timestamp, and old/new values.

**Models:** new `Role`, `AuditLog`, `Session`; `User` extended (role→Role.key, avatar, invite/reset
tokens, failed-login/lock, 2FA-ready flag, lastLoginIp). **APIs added:** `/api/auth/{refresh,logout,
change-password,forgot-password,reset-password}`; `/api/users` (list/invite/get/update/reset-password/
delete/revoke-session); `/api/roles` (list/create/update/delete); `/api/audit`. Existing routes now use
`requirePermission(resource, action)`.

**Admin:** Users page (invite dialog, drawer with role change / activate / reset / sessions), Roles page
(**permission matrix editor** + custom roles), Audit Log page, Remember-Me + Forgot-password on login,
transparent token refresh, and **permission-gated navigation** (you only see what you can access).

**Verified (27/27 e2e + no regressions):** login (token+refresh+isSuperAdmin), /me, refresh, invite →
set-password, viewer denied edit/users/roles/refund (403), super-admin bypass, **role change immediate**,
**permission change immediate**, finance can refund but not edit CMS, deactivation blocks token, self /
last-super-admin guards, **account lock (423)**, audit populated with ip+timestamp, weak-password
rejection. Admin builds (58 modules).

**Known limitations:** invite/reset tokens are returned in-response in non-production (surfaced to the
admin) until **SMTP is wired in Module 2.8**; 2FA is schema-ready but not enforced; refresh tokens aren't
rotated on use (revocable via sessions); per-page UI gating hides nav but the backend is the real gate.

## Roadmap — remaining modules (revised order)

**2.8 Settings & Site Configuration** (SMTP/email, Razorpay & Cloudinary & Google-Sheets config stored
securely, branding: logo/favicon/colours/fonts, contact, social, SEO — so the client never edits config
files) · **2.9 Certificate & Attendance (QR)** · **2.10 Email + WhatsApp Automation** ·
**2.11 Analytics & Reports** · **2.12 Backup, Restore & Audit** · **3.0 AI Assistant**. Cross-cutting: a
**Form Builder** (client adds registration fields — Hospital Name, License Number… — without code).

Homepage CMS with per-section enable/disable + drag-reorder + preview; **Media Manager** on Cloudinary;
**Registration Manager** (search/filter/sort/CSV+Excel/status/bulk — built on the `Registration` model
above); **Workshop Manager** (multiple workshops, active-workshop selection); **Payments** view; **Users**
& roles; and a consolidated **Settings** screen. UI polish: glassmorphism, animations, pagination,
confirmation dialogs.
```
