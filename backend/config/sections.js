"use strict";
/**
 * Canonical homepage body sections — the single source of truth for the DEFAULT
 * order + friendly labels. The content for each lives under the matching key in
 * SiteConfig.data (e.g. data.hero). The public site renders them in the order
 * given by data.sections (the manifest); this list is the fallback + the seed.
 *
 * Order here MUST match the historical render order in frontend/js/app.js so an
 * un-migrated site looks identical.
 */
const SECTION_DEFS = [
  { key: "hero",         label: "Hero" },
  { key: "testimonials", label: "Success Stories / Testimonials" },
  { key: "problem",      label: "Problem (“If You Are…”)" },
  { key: "modules",      label: "What You'll Learn (Curriculum)" },
  { key: "whyDifferent", label: "Why This Workshop Is Different" },
  { key: "audience",     label: "Who Should Attend" },
  { key: "choice",       label: "Your Choice Today" },
  { key: "trainer",      label: "Meet Your Trainer" },
  { key: "bonus",        label: "Benefits / Bonus Offers" },
  { key: "guarantee",    label: "Guarantee" },
  { key: "faq",          label: "FAQ" },
  { key: "finalCta",     label: "Final CTA" },
];

const DEFAULT_ORDER = SECTION_DEFS.map((s) => s.key);

/** Default manifest: every section, in canonical order, enabled. */
function defaultManifest() {
  return SECTION_DEFS.map((s) => ({ key: s.key, enabled: true }));
}

/**
 * Non-destructively ensure `data.sections` exists and covers every known key.
 * - Missing manifest → seed the default.
 * - Manifest present → keep its order/flags, append any new/known keys at the end,
 *   drop unknown keys. Returns the (possibly new) data object; does not mutate input.
 */
function normalizeManifest(data) {
  const src = data && typeof data === "object" ? data : {};
  const known = new Set(DEFAULT_ORDER);
  let manifest = Array.isArray(src.sections) ? src.sections.filter((s) => s && known.has(s.key)) : null;
  if (!manifest || !manifest.length) {
    manifest = defaultManifest();
  } else {
    const seen = new Set(manifest.map((s) => s.key));
    for (const key of DEFAULT_ORDER) if (!seen.has(key)) manifest.push({ key, enabled: true });
    manifest = manifest.map((s) => ({ key: s.key, enabled: s.enabled !== false }));
  }
  return { ...src, sections: manifest };
}

module.exports = { SECTION_DEFS, DEFAULT_ORDER, defaultManifest, normalizeManifest };
