"use strict";
/**
 * Keeps the two stores of workshop-owned content consistent.
 *
 * Workshop-owned top-level keys exist in BOTH places:
 *   - SiteConfig.data — the base the Content Editor edits and publishes
 *   - the active Workshop's `content` overlay — what the public site actually
 *     serves, because siteConfigController.compose() lets the overlay win
 *
 * Without syncing, a Content Editor publish updates a base that the overlay
 * immediately shadows (the live site never changes), while the Workshops list
 * (which reads the Workshop collection) keeps showing the old values. These
 * helpers propagate every publish/save to the other store, so both modules and
 * the public site always agree.
 *
 * Direction 1 — pushBaseToActiveWorkshop(base):
 *   after a SiteConfig publish/revert, copy the workshop-owned keys of the new
 *   base into the active workshop's content (and refresh its list title).
 * Direction 2 — pushWorkshopToBase(workshop):
 *   when the LIVE active workshop is edited or a workshop is activated, mirror
 *   its content into SiteConfig.data (already live via the overlay) and into
 *   the draft (if one exists) so the Content Editor shows current values.
 *
 * Both write documents directly (no controller re-entry), so no sync loops.
 */
const Workshop = require("../models/Workshop");
const SiteConfig = require("../models/SiteConfig");

/** Top-level content keys a workshop OWNS (overlaid on the SiteConfig base). */
const WORKSHOP_KEYS = [
  "workshop", "hero", "seo", "registration", "modules", "faq", "testimonials",
  "trainer", "bonus", "guarantee", "choice", "problem", "whyDifferent",
  "audience", "finalCta", "gallery", "certificates", "sponsors",
];

function isPlainObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

/**
 * Merge `overlay` onto `base`: plain objects merge recursively; arrays and
 * scalars replace. The Workshop editor writes PARTIAL nested objects (e.g.
 * hero = {title} only) — replacing a complete base object with such a partial
 * drops fields the public renderers require (hero.facts etc.), which blanked
 * the site below the navbar. Merging keeps every field the overlay doesn't
 * explicitly define.
 */
function deepMerge(base, overlay) {
  if (!isPlainObject(base) || !isPlainObject(overlay)) {
    return overlay === undefined ? base : overlay;
  }
  const out = { ...base };
  for (const [k, v] of Object.entries(overlay)) {
    out[k] = isPlainObject(v) && isPlainObject(base[k]) ? deepMerge(base[k], v) : v;
  }
  return out;
}

/** The workshop the public site is currently serving (active + effectively live). */
async function findActiveWorkshop() {
  const now = new Date();
  return Workshop.findOne({
    isActive: true,
    status: "published",
    $or: [{ scheduledFor: null }, { scheduledFor: { $lte: now } }],
  });
}

/**
 * SiteConfig → active Workshop. Copies every workshop-owned key present in the
 * base into the active workshop's content; keys only the workshop defines are
 * kept. Also refreshes the workshop's list title from base.workshop.name so the
 * Workshops list matches what was just published. No-op when nothing is active.
 * Returns the synced workshop (or null).
 */
async function pushBaseToActiveWorkshop(base) {
  if (!isPlainObject(base)) return null;
  const w = await findActiveWorkshop();
  if (!w) return null;

  const content = isPlainObject(w.content) ? { ...w.content } : {};
  for (const k of WORKSHOP_KEYS) if (base[k] !== undefined) content[k] = base[k];
  w.content = content;
  w.markModified("content");

  const name = base.workshop && base.workshop.name;
  if (typeof name === "string" && name.trim()) w.title = name.trim();
  const heroSub = base.hero && base.hero.subtitle;
  if (typeof heroSub === "string") w.subtitle = heroSub;

  await w.save();
  return w;
}

/**
 * Workshop → SiteConfig. Mirrors the workshop's content keys into the published
 * base (they are already live through the overlay — this keeps the base honest)
 * and into the draft when one exists, so the Content Editor never shows stale
 * workshop facts. Does not bump the publish version: nothing new went live.
 */
async function pushWorkshopToBase(workshop) {
  if (!workshop || !isPlainObject(workshop.content)) return null;
  const doc = await SiteConfig.getSingleton();

  let changed = false;
  const apply = (target) => {
    if (!isPlainObject(target)) return target;
    for (const k of WORKSHOP_KEYS) {
      if (workshop.content[k] !== undefined) {
        // Merge, don't replace: partial workshop objects must never gut the
        // complete base objects the Content Editor and public site rely on.
        target[k] = deepMerge(target[k], workshop.content[k]);
        changed = true;
      }
    }
    // Ensure the Workshop model's title propagates as data.workshop.name
    // so the dashboard and other consumers always show the current name.
    if (workshop.title && isPlainObject(target.workshop)) {
      target.workshop.name = workshop.title;
      changed = true;
    }
    return target;
  };

  doc.data = apply(doc.data || {});
  doc.markModified("data");
  if (doc.draft != null) {
    doc.draft = apply(doc.draft);
    doc.markModified("draft");
  }
  if (!changed) return null;
  await doc.save();
  return doc;
}

module.exports = { WORKSHOP_KEYS, deepMerge, findActiveWorkshop, pushBaseToActiveWorkshop, pushWorkshopToBase };
