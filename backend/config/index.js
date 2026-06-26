"use strict";
/**
 * Central config — the ONLY place env vars are read. Never hardcode secrets.
 * Copy .env.example → .env and fill it in (see backend/README.md).
 */
require("dotenv").config();

const NODE_ENV = process.env.NODE_ENV || "development";
const isProd = NODE_ENV === "production";

const required = ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "GOOGLE_SHEET_ENDPOINT"];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  // Fail loud at boot — a production payment system must not run half-configured.
  console.error(`[config] Missing required env vars: ${missing.join(", ")}. Copy .env.example → .env and fill them in.`);
}

// CORS allow-list. FRONTEND_URL is the deployed site (comma-separated for
// multiple origins). In development we also allow common localhost origins.
const frontendOrigins = String(process.env.FRONTEND_URL || process.env.ALLOWED_ORIGIN || "")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);
const devOrigins = isProd ? [] : [
  "http://localhost:5173", "http://127.0.0.1:5173",
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
  isConfigured() {
    return missing.length === 0;
  },
};
