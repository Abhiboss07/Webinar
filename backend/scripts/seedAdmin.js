"use strict";
/**
 * Creates (or resets) the first admin user from env credentials.
 *
 *   ADMIN_EMAIL=...  ADMIN_PASSWORD=...  npm run seed:admin
 *
 * Safe to re-run: if the user already exists, its password is reset to the
 * current ADMIN_PASSWORD (handy if the client forgets it). Run this ONCE after
 * setting env vars, then log in through the admin panel.
 */
const config = require("../config");
const { connectDB, mongoose } = require("../db/connect");
const User = require("../models/User");
const { ensureRoles } = require("./seedRoles");

/**
 * Boot-time bootstrap (server.js): create the admin from ADMIN_EMAIL /
 * ADMIN_PASSWORD only if it doesn't exist yet. NEVER touches an existing
 * account (no password reset — that's what the manual `npm run seed:admin`
 * below is for). Returns null when the env vars aren't set.
 */
async function ensureAdminUser() {
  if (!config.admin.email || !config.admin.password) return null;
  await ensureRoles();
  const existing = await User.findOne({ email: config.admin.email });
  if (existing) return { user: existing, isNew: false };
  const user = new User({ email: config.admin.email, name: config.admin.name, role: "super_admin" });
  await user.setPassword(config.admin.password);
  await user.save();
  return { user, isNew: true };
}

async function main() {
  if (!config.admin.email || !config.admin.password) {
    console.error("✗ ADMIN_EMAIL and ADMIN_PASSWORD must be set in backend/.env");
    process.exit(1);
  }
  if (config.admin.password.length < 8) {
    console.error("✗ ADMIN_PASSWORD must be at least 8 characters.");
    process.exit(1);
  }

  await connectDB();
  await ensureRoles(); // RBAC roles must exist before assigning one

  let user = await User.findOne({ email: config.admin.email }).select("+passwordHash");
  const isNew = !user;
  if (!user) {
    // The bootstrap account is a Super Admin (full access, incl. role management).
    user = new User({ email: config.admin.email, name: config.admin.name, role: "super_admin" });
  } else {
    user.name = config.admin.name || user.name;
    if (user.role !== "super_admin") user.role = "super_admin";
  }
  await user.setPassword(config.admin.password);
  user.active = true; user.failedLoginAttempts = 0; user.lockUntil = null;
  await user.save();

  console.log(`✓ Admin ${isNew ? "created" : "updated"}: ${user.email} (role: ${user.role})`);
  await mongoose.disconnect();
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("✗ seedAdmin failed:", err.message);
    process.exit(1);
  });
}

module.exports = { ensureAdminUser };
