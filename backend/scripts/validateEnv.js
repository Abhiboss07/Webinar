"use strict";
/** Validate required environment before deploy/boot. Exits non-zero if missing.
 *  Use in CI / pre-start:  node scripts/validateEnv.js */
require("dotenv").config();

const REQUIRED = ["MONGODB_URI", "JWT_SECRET", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "GOOGLE_SHEET_ENDPOINT"];
const RECOMMENDED = ["SETTINGS_ENC_KEY", "ADMIN_EMAIL", "ADMIN_PASSWORD", "FRONTEND_URL", "API_URL"];

const missing = REQUIRED.filter((k) => !process.env[k]);
const missingRec = RECOMMENDED.filter((k) => !process.env[k]);

if (missingRec.length) console.warn(`⚠  Recommended env not set: ${missingRec.join(", ")}`);
if (missing.length) {
  console.error(`✗ Missing REQUIRED env: ${missing.join(", ")}`);
  process.exit(1);
}
if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 16) {
  console.error("✗ JWT_SECRET is too short (use `openssl rand -hex 32`).");
  process.exit(1);
}
console.log("✓ Environment looks valid.");
process.exit(0);
