# Youngness Workshop — Payment Backend (Node + Express)

Secure registration + Razorpay payment API. Holds the Razorpay **Key Secret**;
the browser only ever sees the public **Key ID**. Persists to Google Sheets via
the deployed Apps Script web app. Deploys to **Render**.

## Structure
```
backend/
├── server.js                 # entry — starts the app (listen)
├── app.js                    # express app: middleware, CORS, routes, errors
├── config/index.js           # the ONLY place env vars are read
├── routes/paymentRoutes.js   # POST /register, /create-order, /verify-payment
├── controllers/              # registration / order / payment
├── services/                 # razorpayService (order + HMAC verify), sheetService
├── middleware/               # logger, errorHandler (404/500), validate
├── utils/helpers.js          # clean(), isEmail(), receiptFor()
├── .env.example              # copy → .env and fill in (never commit .env)
└── package.json
```

## Endpoints
| Method | Path | Purpose |
|---|---|---|
| GET  | `/health` | Liveness + whether env is fully configured. |
| POST | `/register` | Save the lead as **Pending** (before payment). Body: `regId, fullName, mobile, email, profession, city, experience, mode, workshop, source`. |
| POST | `/create-order` | Create a Razorpay order. Body: `regId`. **Amount is server-owned** (env `AMOUNT`). Returns `orderId, amount, currency, keyId`. |
| POST | `/verify-payment` | Verify the signature (HMAC-SHA256) and mark **Paid**. Body: `regId, razorpay_order_id, razorpay_payment_id, razorpay_signature`. Returns `{status:"success"}` only on a valid signature. |

## Setup
```bash
cd backend
cp .env.example .env      # fill in real values
npm install
npm start                 # or: npm run dev  (node --watch)
```

Env (see `.env.example`): `PORT`, `NODE_ENV`, `FRONTEND_URL` (CORS allow-list),
`API_URL`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `GOOGLE_SHEET_ENDPOINT`,
`SHEET_SHARED_TOKEN`, `AMOUNT`, `CURRENCY`, `WORKSHOP_NAME`. **Never commit `.env`.**

Set the matching `SHEET_SHARED_TOKEN` as a **Script Property** in the Apps Script
project so it accepts writes only from this backend.

## Security
- Key Secret is backend-only; signature verified with `HMAC-SHA256(order_id|payment_id, secret)`
  using a constant-time compare before any "Paid" write.
- Order amount comes from server config, so the client can't change the price.
- Frontend success callbacks are never trusted — only the verified result marks Paid.
- CORS is restricted to `FRONTEND_URL`; localhost origins are auto-allowed only in development.

## Frontend wiring
Set `api.prod` (this server's public URL) in
`../frontend/config/workshop-config.js` (bootstrap + offline fallback; content
itself is CMS-driven). The frontend auto-uses `api.dev` (localhost:4000) when
served from localhost. The public Razorpay Key ID is returned by
`/create-order` — never configured in the frontend.

## Startup (fail-fast)
`server.js` boots strictly in this order and **exits** on failure — the app
never runs half-configured (no more "buffering timed out" zombies):

1. **Env validation** — missing vars *and* leftover `.env.example` placeholder
   values (e.g. `rzp_test_ADD_LATER`) abort the boot in production
   (`config.envProblems()`, also run by `npm start`'s prestart hook).
2. **MongoDB connect** — Express, workers, queues and seeds all wait for it;
   if Mongo is unreachable the process exits and the host restarts it.
   Mongoose command buffering is disabled (`db/connect.js`).
3. **Account bootstrap** — admin (from `ADMIN_EMAIL`/`ADMIN_PASSWORD`, create
   **only if missing**, never resets an existing password) and the Razorpay
   demo account below.
4. **Workers** (comm queue, scheduled backups), then `listen()`.

`GET /health` returns per-dependency status (Mongo, Razorpay, Cloudinary,
SMTP, Sheets, env) — booleans only, never secrets — with HTTP 503 when a
payment-critical check fails. `GET /health/ready` stays a bare DB probe for
container healthchecks.

## Razorpay verification (demo) account
Razorpay's website-verification team needs a working test login. A permanent,
read-only demo account is seeded **automatically at every server boot**
(`server.js` → `scripts/seedRazorpayDemo.js`) and can also be seeded manually:

```bash
npm run seed:razorpay-demo
```

- **Where it lives:** the `users` collection in MongoDB (hashed with bcrypt,
  same as admin accounts) — never in the frontend or in any committed config.
- **Credentials:** `razorpay-demo@youngness.com` / `Demo@12345`
  (override with `RAZORPAY_DEMO_EMAIL` / `RAZORPAY_DEMO_PASSWORD` env vars).
- **Access:** role `viewer` — it can log in to the admin panel but is
  read-only everywhere. The public registration → payment → Razorpay Checkout
  flow requires **no login** (any visitor can complete it), so this account
  exists purely to satisfy the "test login" requirement.
- **Idempotent:** seeding never creates duplicates (unique email index +
  find-or-create). If the password, role, active flag, or lockout state has
  drifted, re-seeding repairs it so the credentials given to Razorpay keep
  working.
