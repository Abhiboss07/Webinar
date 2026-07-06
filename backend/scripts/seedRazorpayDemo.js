"use strict";
/**
 * Razorpay verification/demo account — a permanent, low-privilege login that
 * Razorpay's team uses to verify the website during KYC/activation.
 *
 * The account lives in the `users` collection (same as admin logins) with the
 * read-only "viewer" role, so it can log in to the admin panel but cannot
 * change anything. The public registration → payment → Razorpay Checkout flow
 * needs no login at all, so this account exists purely to satisfy Razorpay's
 * "working test login" requirement.
 *
 * Seeding is idempotent and runs automatically at server boot (server.js) —
 * the unique email index plus find-or-create prevents duplicates. If the
 * account exists but its password/role/active state has drifted, it is
 * repaired so the credentials given to Razorpay always keep working.
 *
 * Run standalone with:  npm run seed:razorpay-demo
 * Override defaults via RAZORPAY_DEMO_EMAIL / RAZORPAY_DEMO_PASSWORD env vars.
 */
const { connectDB, mongoose } = require("../db/connect");
const User = require("../models/User");
const { ensureRoles } = require("./seedRoles");

const DEMO_EMAIL = (process.env.RAZORPAY_DEMO_EMAIL || "razorpay-demo@awishclinic.com").trim().toLowerCase();
const DEMO_PASSWORD = process.env.RAZORPAY_DEMO_PASSWORD || "StrongPass@123";

async function ensureRazorpayDemoUser() {
  await ensureRoles(); // "viewer" role must exist before assigning it

  let user = await User.findOne({ email: DEMO_EMAIL }).select("+passwordHash");
  const isNew = !user;
  if (!user) {
    user = new User({ email: DEMO_EMAIL, name: "Razorpay Verification (Demo)" });
  }

  // Repair drift: the credentials handed to Razorpay must always work, and the
  // account must never hold more than read-only access.
  const passwordOk = !isNew && (await user.verifyPassword(DEMO_PASSWORD));
  if (!passwordOk) await user.setPassword(DEMO_PASSWORD);
  user.role = "viewer";
  user.active = true;
  user.mustResetPassword = false;
  user.failedLoginAttempts = 0;
  user.lockUntil = null;
  await user.save();

  return { user, isNew };
}

async function main() {
  await connectDB();
  const { user, isNew } = await ensureRazorpayDemoUser();
  console.log(`✓ Razorpay demo account ${isNew ? "created" : "verified"}: ${user.email} (role: ${user.role})`);
  await mongoose.disconnect();
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("✗ seedRazorpayDemo failed:", err.message);
    process.exit(1);
  });
}

module.exports = { ensureRazorpayDemoUser, DEMO_EMAIL };
