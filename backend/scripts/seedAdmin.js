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

  let user = await User.findOne({ email: config.admin.email }).select("+passwordHash");
  const isNew = !user;
  if (!user) {
    user = new User({ email: config.admin.email, name: config.admin.name, role: "admin" });
  } else {
    user.name = config.admin.name || user.name;
  }
  await user.setPassword(config.admin.password);
  await user.save();

  console.log(`✓ Admin ${isNew ? "created" : "password reset"}: ${user.email} (role: ${user.role})`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error("✗ seedAdmin failed:", err.message);
  process.exit(1);
});
