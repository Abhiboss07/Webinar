"use strict";
/**
 * Central config — the ONLY place env vars are read. Never hardcode secrets.
 * Copy .env.example → .env and fill it in (see backend/README.md).
 */
require("dotenv").config();

const NODE_ENV = process.env.NODE_ENV || "development";
const isProd = NODE_ENV === "production";

// Payment/sheets are required for the live registration flow. MONGODB_URI is
// required for the CMS (content API + admin). JWT_SECRET secures admin sessions.
const required = [
  "RAZORPAY_KEY_ID",
  "RAZORPAY_KEY_SECRET",
  "GOOGLE_SHEET_ENDPOINT",
  "MONGODB_URI",
  "JWT_SECRET",
];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  // Fail loud at boot — a production payment system must not run half-configured.
  console.error(`[config] Missing required env vars: ${missing.join(", ")}. Copy .env.example → .env and fill them in.`);
}

// CORS allow-list. FRONTEND_URL is the deployed site (comma-separated for
// multiple origins, e.g. public site + admin panel). In development we also
// allow common localhost origins (Vite dev server included).
const frontendOrigins = String(process.env.FRONTEND_URL || process.env.ALLOWED_ORIGIN || "")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);
const devOrigins = isProd ? [] : [
  "http://localhost:5173", "http://127.0.0.1:5173",
  "http://localhost:5174", "http://127.0.0.1:5174",
  "http://localhost:3000", "http://127.0.0.1:3000",
  "http://localhost:8080", "http://127.0.0.1:8080",
];
const allowedOrigins = frontendOrigins.length ? frontendOrigins.concat(devOrigins) : (isProd ? [] : devOrigins);

module.exports = {
  env: NODE_ENV,
  isProd,
  port: parseInt(process.env.PORT || "4000", 10),
  apiUrl: process.env.API_URL || "",       // this backend's own public URL (docs/health)
  allowedOrigins,                          // [] in prod with no FRONTEND_URL → CORS blocked (safe)
  // Charge is server-owned so the client can never tamper with the price.
  amount: parseInt(process.env.AMOUNT || "9900", 10), // paise
  currency: process.env.CURRENCY || "INR",
  workshopName: process.env.WORKSHOP_NAME || "Workshop Registration",
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || "",
    keySecret: process.env.RAZORPAY_KEY_SECRET || "",
  },
  sheet: {
    endpoint: process.env.GOOGLE_SHEET_ENDPOINT || "",
    token: process.env.SHEET_SHARED_TOKEN || "",
  },
  // ---- CMS (added in the DB migration) ----
  mongoUri: process.env.MONGODB_URI || "",
  jwt: {
    secret: process.env.JWT_SECRET || "",
    // Admin session lifetime. Keep it short-ish; the admin can re-login.
    expiresIn: process.env.JWT_EXPIRES_IN || "12h",
  },
  // ---- Media storage (Module 2.3) ----
  // Provider: "cloudinary" in production, "local" for dev/fallback. Auto-detects
  // cloudinary when its cloud name is present, otherwise falls back to local disk.
  storage: {
    provider: (process.env.STORAGE_PROVIDER || (process.env.CLOUDINARY_CLOUD_NAME ? "cloudinary" : "local")).toLowerCase(),
    // Local adapter: files saved here and served at <publicBaseUrl>/uploads/…
    uploadDir: process.env.UPLOAD_DIR || "uploads",
    // Absolute base for building local file URLs (must be reachable by the site).
    publicBaseUrl: (process.env.API_URL || `http://localhost:${parseInt(process.env.PORT || "4000", 10)}`).replace(/\/$/, ""),
    maxBytes: parseInt(process.env.MEDIA_MAX_BYTES || String(25 * 1024 * 1024), 10), // 25MB
  },
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET || "",
    baseFolder: process.env.CLOUDINARY_FOLDER || "youngness",
  },
  // Bootstrap admin — used ONCE by scripts/seedAdmin.js to create the first user.
  // After seeding, credentials live (hashed) in the DB; changing these env vars
  // does NOT change an existing admin's password (re-run seed:admin to reset).
  admin: {
    email: (process.env.ADMIN_EMAIL || "").trim().toLowerCase(),
    password: process.env.ADMIN_PASSWORD || "",
    name: process.env.ADMIN_NAME || "Administrator",
  },
  isConfigured() {
    return missing.length === 0;
  },
};
