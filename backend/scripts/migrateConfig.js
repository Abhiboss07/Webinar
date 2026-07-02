"use strict";
/**
 * One-time migration: import the entire legacy config/workshop-config.js into the
 * database (SiteConfig singleton), then verify a byte-for-byte round-trip so we
 * can prove every previous value now lives in — and is served from — the DB.
 *
 *   npm run migrate:config                       # default source path
 *   node scripts/migrateConfig.js <path/to/workshop-config.js>
 *
 * After this runs, GET /api/site-config returns exactly what the file held, and
 * the frontend can stop importing the file (it keeps a copy only as an offline
 * fallback). Idempotent: re-running overwrites the stored content with the file.
 */
const fs = require("fs");
const path = require("path");
const config = require("../config");
const { connectDB, mongoose } = require("../db/connect");
const SiteConfig = require("../models/SiteConfig");

// Default to the source (dev) frontend's config file.
const DEFAULT_SRC = path.resolve(__dirname, "../../frontend/config/workshop-config.js");

/** Evaluate the ES-module config file in a sandbox and return the plain object. */
function loadLegacyConfig(file) {
  let text = fs.readFileSync(file, "utf8");
  // Strip the ESM export (illegal inside a Function body). The `window` line is
  // harmless — we pass a dummy `window` object to the factory below.
  text = text.replace(/export\s+default\s+WORKSHOP_CONFIG\s*;?/g, "");
  // eslint-disable-next-line no-new-func
  const factory = new Function("window", `${text}\n;return WORKSHOP_CONFIG;`);
  const data = factory({});
  if (!data || typeof data !== "object") throw new Error("Config file did not produce an object");
  return data;
}

/** Count leaf values (strings/numbers/bools) in a nested structure. */
function countLeaves(v) {
  if (Array.isArray(v)) return v.reduce((n, x) => n + countLeaves(x), 0);
  if (v && typeof v === "object") return Object.values(v).reduce((n, x) => n + countLeaves(x), 0);
  return 1;
}

/** Deep structural equality via canonical JSON (order-independent for objects). */
function canonical(v) {
  if (Array.isArray(v)) return v.map(canonical);
  if (v && typeof v === "object") {
    return Object.keys(v).sort().reduce((o, k) => { o[k] = canonical(v[k]); return o; }, {});
  }
  return v;
}
function deepEqual(a, b) {
  return JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
}

async function main() {
  const srcArg = process.argv[2];
  const src = srcArg ? path.resolve(process.cwd(), srcArg) : DEFAULT_SRC;
  if (!fs.existsSync(src)) throw new Error(`Config file not found: ${src}`);

  console.log(`→ Reading legacy config: ${src}`);
  const data = loadLegacyConfig(src);
  const topKeys = Object.keys(data);
  const totalLeaves = countLeaves(data);

  await connectDB();
  const doc = await SiteConfig.getSingleton();
  doc.data = data;
  doc.version = (doc.version || 1) + 1;
  doc.markModified("data");
  await doc.save();

  // Verify the round-trip: read back from Mongo and compare to the source.
  const fresh = await SiteConfig.findOne({ key: "default" }).lean();
  const ok = deepEqual(data, fresh.data);

  // ---- Migration report ----
  const report = {
    source: src,
    migratedAt: new Date().toISOString(),
    version: doc.version,
    topLevelSections: topKeys.length,
    totalValues: totalLeaves,
    roundTripVerified: ok,
    sections: topKeys.map((k) => ({ key: k, values: countLeaves(data[k]) })),
  };
  const reportPath = path.resolve(__dirname, "migration-report.json");
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log("\n================ MIGRATION REPORT ================");
  console.log(`Top-level sections : ${report.topLevelSections}`);
  console.log(`Total values       : ${report.totalValues}`);
  report.sections.forEach((s) => console.log(`  • ${s.key.padEnd(16)} ${s.values} values`));
  console.log(`Round-trip verified: ${ok ? "✓ PASS — DB matches the file exactly" : "✗ FAIL — mismatch!"}`);
  console.log(`Report written to  : ${reportPath}`);
  console.log("==================================================\n");

  await mongoose.disconnect();
  process.exit(ok ? 0 : 2);
}

main().catch((err) => {
  console.error("✗ migrateConfig failed:", err.message);
  process.exit(1);
});
