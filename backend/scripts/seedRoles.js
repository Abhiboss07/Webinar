"use strict";
/**
 * Seed the seven system roles (idempotent — never clobbers a role an admin has
 * already customised). Run standalone (`npm run seed:roles`) or via seedAdmin.
 */
const { connectDB, mongoose } = require("../db/connect");
const Role = require("../models/Role");
const { DEFAULT_ROLES } = require("../services/rbac");

async function ensureRoles() {
  let created = 0;
  for (const def of DEFAULT_ROLES) {
    const exists = await Role.findOne({ key: def.key });
    if (!exists) { await Role.create(def); created += 1; }
  }
  return created;
}

async function main() {
  await connectDB();
  const created = await ensureRoles();
  console.log(`✓ Roles ensured (${created} created, ${DEFAULT_ROLES.length - created} already present).`);
  await mongoose.disconnect();
  process.exit(0);
}

if (require.main === module) main().catch((e) => { console.error("✗ seedRoles failed:", e.message); process.exit(1); });

module.exports = { ensureRoles };
