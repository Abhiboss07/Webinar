"use strict";
/** Validate required environment before deploy/boot. Exits non-zero if missing
 *  or still holding template placeholder values (single source of truth:
 *  config.envProblems()). Use in CI / pre-start:  node scripts/validateEnv.js */
const config = require("../config");

const RECOMMENDED = ["SETTINGS_ENC_KEY", "ADMIN_EMAIL", "ADMIN_PASSWORD", "FRONTEND_URL", "API_URL"];
const missingRec = RECOMMENDED.filter((k) => !process.env[k]);
if (missingRec.length) console.warn(`⚠  Recommended env not set: ${missingRec.join(", ")}`);

const problems = config.envProblems();
if (problems.length) {
  console.error("✗ Environment is not production-ready:");
  for (const p of problems) console.error(`   - ${p}`);
  process.exit(1);
}
console.log("✓ Environment looks valid.");
process.exit(0);
