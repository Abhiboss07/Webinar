"use strict";
/**
 * One-time: create the first Workshop from the current SiteConfig content so the
 * public site keeps rendering the same workshop after Module 2.4. Idempotent —
 * skips if any workshop already exists (pass --force to seed anyway).
 *
 *   npm run seed:workshop
 */
const { connectDB, mongoose } = require("../db/connect");
const SiteConfig = require("../models/SiteConfig");
const Workshop = require("../models/Workshop");
const { WORKSHOP_KEYS } = require("../services/workshopSync");
const { slugify } = require("../utils/helpers");

async function main() {
  const force = process.argv.includes("--force");
  await connectDB();

  const count = await Workshop.countDocuments({});
  if (count > 0 && !force) {
    console.log(`✓ ${count} workshop(s) already exist — nothing to seed (use --force to override).`);
    await mongoose.disconnect();
    return process.exit(0);
  }

  const doc = await SiteConfig.getSingleton();
  const data = doc.data || {};
  // Mirror EXACTLY the keys present in the base so the composed public output is
  // byte-identical to today's. New keys (gallery/certificates/sponsors) are added
  // later by the editor on demand — not injected here.
  const content = {};
  for (const k of WORKSHOP_KEYS) if (data[k] !== undefined) content[k] = data[k];

  const title = (data.workshop && data.workshop.name) || "Workshop";
  const slug = slugify(title);

  const w = await Workshop.create({
    title,
    subtitle: (data.hero && data.hero.subtitle) || "",
    description: (data.hero && data.hero.description) || "",
    category: "Workshop",
    slug,
    status: "published",
    isActive: true,
    content,
  });

  console.log(`✓ Seeded active workshop “${w.title}” (slug: ${w.slug}) with ${Object.keys(content).length} content keys.`);
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((err) => { console.error("✗ seedWorkshopFromConfig failed:", err.message); process.exit(1); });
