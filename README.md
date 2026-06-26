# Youngness Workshop — Registration & Payment Platform

A production-ready, config-driven workshop registration site with a real
Razorpay payment flow.

- **Frontend** — static HTML/CSS/JS (Tailwind compiled). Deploys to **Hostinger**
  at `https://awishclinic.com/workshop/`.
- **Backend** — Node.js + Express. Deploys to **Render**. Holds the Razorpay
  **secret**, verifies payment signatures, and writes to Google Sheets.

A registration is **only complete after a backend-verified payment** — no demo,
no fake success, no thank-you before verification.

---

## Folder structure

```
youngness-workshop/                 ← repo root (the "Workshop")
├── frontend/                       → Hostinger (static)
│   ├── assets/                     images + logo
│   ├── css/                        main.css (compiled) · components.css · responsive.css
│   ├── js/                         app.js · config.js · api.js · payment.js · form.js · popup.js · toast.js
│   ├── config/workshop-config.js   ⭐ THE single config file (edit this)
│   ├── sections/                   per-section render modules (+ _shared.js, index.js)
│   ├── src/input.css               Tailwind build input
│   ├── tailwind.config.js · package.json · .htaccess
│   ├── index.html · thank-you.html
│
├── backend/                        → Render (Node/Express)
│   ├── app.js · server.js
│   ├── config/   (env — the only place secrets are read)
│   ├── routes/   (POST /register, /create-order, /verify-payment)
│   ├── controllers/  services/  middleware/  utils/
│   ├── package.json · .env.example · README.md
│
└── google-apps-script.gs           Google Sheets data layer (token-protected)
```

---

## The single config file

Everything content-related lives in **`frontend/config/workshop-config.js`**:
workshop name, **price**, venue, date, time, **map**, **contact**, the **API base
URL** (`api.dev` / `api.prod`), the **public Razorpay key** (`payment.keyId`),
images and trainer details. Change it once → the whole site updates.

`{{tokens}}` (`{{name}} {{date}} {{time}} {{venue}} {{price}} {{originalPrice}}
{{bonusValue}} {{brand}}`) are set once in `workshop` and expand everywhere.

> **Security:** only the *public* Razorpay Key ID lives in the frontend config.
> The Key **Secret** lives ONLY in `backend/.env` — never in the repo or browser.

---

## Local development

**Frontend** (needs a static server because it uses ES modules — `file://` won't work):
```bash
cd frontend
npm install          # one-time: installs Tailwind (dev only)
npm run build:css    # compile css/main.css  (use `npm run watch:css` while editing)
npm run serve        # http://localhost:5173
```

**Backend:**
```bash
cd backend
npm install
cp .env.example .env # then fill in the values
npm run dev          # http://localhost:4000  (auto-restarts)
```

On `localhost`, `js/api.js` automatically targets `api.dev` (the local backend).
On any other host it targets `api.prod`.

---

## Production deployment

### Frontend → Hostinger
1. `cd frontend && npm install && npm run build:css` (produces `css/main.css`).
2. In `config/workshop-config.js` set:
   - `payment.keyId` → your **live** Razorpay Key ID (public).
   - `api.prod` → your Render backend URL.
3. Upload the **contents of `frontend/`** (incl. `assets/`, `css/`, `js/`,
   `sections/`, `config/`, `index.html`, `thank-you.html`, `.htaccess`) to the
   `/workshop/` directory via Hostinger File Manager / FTP. (`node_modules`,
   `src/`, `package.json`, `tailwind.config.js` are **not** needed on the host.)

### Backend → Render
1. New **Web Service** → repo root directory `backend/`.
2. Build command `npm install`, start command `npm start`.
3. Add environment variables (below). **Never commit `.env`.**
4. Health check path `/health`.

### Environment variables (backend `.env` / Render dashboard)

| Variable | Purpose |
|---|---|
| `PORT` | Server port (Render sets this automatically). |
| `NODE_ENV` | `production` in prod. |
| `FRONTEND_URL` | Allowed CORS origin(s), e.g. `https://awishclinic.com`. Comma-separate for several. |
| `API_URL` | This backend's public URL (informational). |
| `RAZORPAY_KEY_ID` | Public key (also used by the frontend). |
| `RAZORPAY_KEY_SECRET` | **Secret — backend only. Never expose.** |
| `GOOGLE_SHEET_ENDPOINT` | Deployed Apps Script Web App URL. |
| `SHEET_SHARED_TOKEN` | Must match the Apps Script Script Property of the same name. |
| `AMOUNT` | Charge in **paise** (server-owned; the client can't change it). |
| `CURRENCY` / `WORKSHOP_NAME` | Currency code / workshop label. |

---

## API endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/health` | Liveness + config status. |
| `POST` | `/register` | Save the lead as **Pending** (before payment). |
| `POST` | `/create-order` | Create a Razorpay order (amount from server config). |
| `POST` | `/verify-payment` | Verify the HMAC-SHA256 signature → mark **Paid**. |

---

## Payment flow

```
User fills form → frontend validation
   → POST /register            (Pending row in Google Sheets)
   → POST /create-order        (Razorpay order; amount server-owned)
   → Razorpay Checkout         (UPI / GPay / PhonePe / Cards / Net-banking / Wallets)
   → POST /verify-payment      (HMAC-SHA256 verified SERVER-SIDE)
        → Sheet flips Pending → Paid (Order ID, Payment ID, Signature, Method, Amount, Time)
   → success → redirect to thank-you.html (only reachable with a verified payment)
```

- **Never trust the frontend.** Only the server's verified `/verify-payment`
  result marks a registration Paid.
- **Amount is server-owned** (`AMOUNT` env) — the browser cannot change the price.
- **Resilience:** if payment fails or the user closes Checkout, the registration
  stays **Pending**, the seat is preserved, and reopening the modal **resumes**
  payment (same `regId`, no duplicate row).
- **Razorpay is the single gateway** — its Checkout exposes UPI/GPay/PhonePe/etc.
  We do **not** build separate gateways; the method cards are a friendly selector.

---

## Google Sheets (data layer)

The sheet is written **only by the backend** (the browser never writes):
1. Create a Sheet → **Extensions → Apps Script**, paste `google-apps-script.gs`.
2. **Project Settings → Script properties** → add `SHEET_SHARED_TOKEN` (long random).
3. **Deploy → Web app** (*Execute as: Me*, *Access: Anyone*). Copy the URL.
4. Backend env: `GOOGLE_SHEET_ENDPOINT` = that URL, `SHEET_SHARED_TOKEN` = same token.

Columns: Timestamp, Reg ID, Full Name, Mobile, Email, Profession, City,
Experience, Preferred Mode, Workshop, Payment Status, Source, Order ID,
Payment ID, Signature, Payment Method, Amount, Transaction Time.

**Social-proof popup** uses the *same* endpoint **read-only** (`GET ?recent=1`,
privacy-filtered to first name + city). It shows only real registrations; if
there are none (or the endpoint is unset / `popup.enabled:false`) it stays hidden.

---

## Performance

- No render-blocking CDN — Tailwind is compiled to a minified `css/main.css`.
- Hero image preloaded; other images lazy-loaded; fixed aspect ratios reduce CLS.
- ES-module scripts are deferred by default.
- `.htaccess` enables gzip + long-lived caching of static assets on Hostinger.

---

## Troubleshooting

- **CORS error in the browser** → `FRONTEND_URL` on the backend must match the
  site origin exactly (scheme + host, no trailing slash).
- **"Could not save registration"** → check `GOOGLE_SHEET_ENDPOINT` and that the
  Apps Script `SHEET_SHARED_TOKEN` matches the backend env; re-deploy the Web app
  after changing the script.
- **"Signature verification failed"** → `RAZORPAY_KEY_SECRET` is wrong or the
  order wasn't created by this backend.
- **Styles look unstyled** → run `npm run build:css` and make sure `css/main.css`
  was uploaded.
- **Blank page / module errors** → the frontend must be served over http(s), not
  opened as a `file://` path (ES modules require it).
