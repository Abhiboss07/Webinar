"use strict";
/**
 * Site content API with a draft → publish workflow.
 *
 *   GET  /api/site-config            → PUBLISHED content (public site)
 *   GET  /api/site-config?preview=1  → DRAFT content (for the admin Preview)
 *   GET  /api/site-config/draft      → draft (admin)                     [auth]
 *   PUT  /api/site-config            → save draft (autosave target)      [auth]
 *   POST /api/site-config/publish    → promote draft → published         [auth]
 *   POST /api/site-config/discard    → drop draft (revert to published)  [auth]
 *   GET  /api/site-config/history    → list published snapshots          [auth]
 *   POST /api/site-config/revert     → restore a snapshot (data + draft)  [auth]
 *
 * The stored objects keep the exact shape the frontend already renders, plus a
 * `sections` manifest (order + enabled) — see config/sections.js.
 */
const SiteConfig = require("../models/SiteConfig");
const Workshop = require("../models/Workshop");
const audit = require("../services/audit");
const provider = require("../services/settingsProvider");
const workshopSync = require("../services/workshopSync");
const { normalizeManifest } = require("../config/sections");

function isPlainObject(v) {
  return v && typeof v === "object" && !Array.isArray(v);
}

/**
 * Resolve the workshop to overlay:
 *  - ?workshop=<slug> (preview any specific workshop, even draft)
 *  - else the active + effectively-live published workshop
 *  - else null (→ site serves the SiteConfig base unchanged; nothing breaks)
 */
async function resolveWorkshop(slug) {
  if (slug) return Workshop.findOne({ slug });
  const now = new Date();
  return Workshop.findOne({
    isActive: true,
    status: "published",
    $or: [{ scheduledFor: null }, { scheduledFor: { $lte: now } }],
  });
}

/** Overlay a workshop's content on the base, preserving the site-wide section
 *  manifest. Deep merge: only the fields the workshop actually defines are
 *  overridden — a partial object (e.g. hero without `facts`) must not gut the
 *  complete base object the section renderers require. */
function compose(base, workshop) {
  if (!workshop || !isPlainObject(workshop.content)) return base;
  return { ...workshopSync.deepMerge(base, workshop.content), sections: base.sections };
}

/** Public: published content (or draft when ?preview=1), with the active/previewed
 *  workshop overlaid. Always manifest-normalized. */
async function getPublic(req, res) {
  try {
    const doc = await SiteConfig.getSingleton();
    const preview = String(req.query.preview || "") === "1";
    const base = normalizeManifest(preview ? (doc.draft || doc.data || {}) : (doc.data || {}));

    // Draft preview shows the draft AS IS (publish syncs it to the active
    // workshop, so the draft IS what will go live) — overlaying the current
    // workshop here would shadow exactly the edits being previewed. An explicit
    // ?workshop=<slug> (Workshop editor preview) still overlays that workshop.
    const slug = String(req.query.workshop || "").trim();
    const workshop = preview && !slug ? null : await resolveWorkshop(slug);
    const data = compose(base, workshop);

    let maintenance = null;
    let theme = null;
    try {
      const pv = await provider.publicView();
      maintenance = pv.maintenance;
      if (pv.buttons) theme = { buttons: pv.buttons };
    } catch (_) { /* optional */ }

    res.set("Cache-Control", preview ? "no-store" : "public, max-age=30, stale-while-revalidate=120");
    return res.json({
      status: "success",
      data,
      preview,
      maintenance,
      theme,
      activeWorkshop: workshop ? { slug: workshop.slug, title: workshop.title, status: workshop.status } : null,
      updatedAt: doc.publishedAt || doc.updatedAt,
    });
  } catch (err) {
    console.error("[site-config/get] error:", err.message);
    return res.status(500).json({ status: "error", message: "Could not load site content" });
  }
}

/** Admin: the draft (falls back to published if no draft yet). Manifest-normalized. */
async function getDraft(req, res) {
  try {
    const doc = await SiteConfig.getSingleton();
    const data = normalizeManifest(doc.draft || doc.data || {});
    return res.json({
      status: "success",
      data,
      hasDraft: doc.draft != null,
      version: doc.version,
      publishedAt: doc.publishedAt,
      draftUpdatedAt: doc.draftUpdatedAt,
    });
  } catch (err) {
    console.error("[site-config/getDraft] error:", err.message);
    return res.status(500).json({ status: "error", message: "Could not load draft" });
  }
}

/** Validate an incoming content object (defensive; the admin also validates live). */
function validateContent(data) {
  if (!isPlainObject(data)) return "Body must be { data: { ... } }";
  if (data.sections != null) {
    if (!Array.isArray(data.sections)) return "sections must be an array";
    for (const s of data.sections) {
      if (!isPlainObject(s) || typeof s.key !== "string" || !s.key) return "each section needs a string key";
    }
  }
  return null;
}

/** Admin: save the draft (autosave-friendly full-document PUT). */
async function saveDraft(req, res) {
  try {
    const incoming = req.body && req.body.data;
    const err = validateContent(incoming);
    if (err) return res.status(400).json({ status: "error", message: err });

    const doc = await SiteConfig.getSingleton();
    doc.draft = normalizeManifest(incoming);
    doc.draftUpdatedAt = new Date();
    doc.updatedBy = req.user ? req.user.id : null;
    doc.markModified("draft");
    await doc.save();
    return res.json({ status: "success", draftUpdatedAt: doc.draftUpdatedAt });
  } catch (err) {
    console.error("[site-config/saveDraft] error:", err.message);
    return res.status(500).json({ status: "error", message: "Could not save draft" });
  }
}

/** Admin: publish the draft. Snapshots the outgoing published data into history. */
async function publish(req, res) {
  try {
    const doc = await SiteConfig.getSingleton();
    if (doc.draft == null) return res.status(400).json({ status: "error", message: "Nothing to publish — no draft changes." });

    // Snapshot the currently-published data (if any) before overwriting.
    if (doc.data && Object.keys(doc.data).length) {
      doc.history.unshift({ data: doc.data, version: doc.version, publishedAt: doc.publishedAt || new Date(), publishedBy: doc.updatedBy });
      doc.history = doc.history.slice(0, SiteConfig.HISTORY_CAP);
    }
    doc.data = normalizeManifest(doc.draft);
    doc.version = (doc.version || 1) + 1;
    doc.publishedAt = new Date();
    doc.draft = null; // clean slate; further edits start a fresh draft from published
    doc.draftUpdatedAt = null;
    doc.updatedBy = req.user ? req.user.id : null;
    doc.markModified("data"); doc.markModified("draft"); doc.markModified("history");
    await doc.save();
    // Mirror the newly published workshop-owned keys into the active workshop,
    // otherwise its content overlay keeps serving the pre-publish values.
    let syncedWorkshop = null;
    try {
      const w = await workshopSync.pushBaseToActiveWorkshop(doc.data);
      if (w) syncedWorkshop = { slug: w.slug, title: w.title };
    } catch (syncErr) {
      console.error("[site-config/publish] workshop sync failed:", syncErr.message);
    }
    await audit.record(req, "content.publish", { resource: "homepage_cms", newValue: { version: doc.version, syncedWorkshop } });
    return res.json({ status: "success", version: doc.version, publishedAt: doc.publishedAt, syncedWorkshop });
  } catch (err) {
    console.error("[site-config/publish] error:", err.message);
    return res.status(500).json({ status: "error", message: "Could not publish" });
  }
}

/** Admin: discard the draft (revert editor to the published version). */
async function discardDraft(req, res) {
  try {
    const doc = await SiteConfig.getSingleton();
    doc.draft = null;
    doc.draftUpdatedAt = null;
    doc.markModified("draft");
    await doc.save();
    return res.json({ status: "success", data: normalizeManifest(doc.data || {}) });
  } catch (err) {
    console.error("[site-config/discard] error:", err.message);
    return res.status(500).json({ status: "error", message: "Could not discard draft" });
  }
}

/** Admin: list published snapshots (metadata only — no heavy data payloads). */
async function history(req, res) {
  try {
    const doc = await SiteConfig.getSingleton();
    const items = (doc.history || []).map((h) => ({ version: h.version, publishedAt: h.publishedAt }));
    return res.json({ status: "success", current: doc.version, history: items });
  } catch (err) {
    console.error("[site-config/history] error:", err.message);
    return res.status(500).json({ status: "error", message: "Could not load history" });
  }
}

/** Admin: restore a snapshot by version → sets both published data AND draft. */
async function revert(req, res) {
  try {
    const version = parseInt((req.body || {}).version, 10);
    const doc = await SiteConfig.getSingleton();
    const snap = (doc.history || []).find((h) => h.version === version);
    if (!snap) return res.status(404).json({ status: "error", message: "That version is not in history" });

    // Snapshot the current published data before overwriting.
    if (doc.data && Object.keys(doc.data).length) {
      doc.history.unshift({ data: doc.data, version: doc.version, publishedAt: doc.publishedAt || new Date(), publishedBy: doc.updatedBy });
      doc.history = doc.history.slice(0, SiteConfig.HISTORY_CAP);
    }
    doc.data = normalizeManifest(snap.data);
    doc.draft = null;
    doc.draftUpdatedAt = null;
    doc.version = (doc.version || 1) + 1;
    doc.publishedAt = new Date();
    doc.updatedBy = req.user ? req.user.id : null;
    doc.markModified("data"); doc.markModified("draft"); doc.markModified("history");
    await doc.save();
    // A revert re-publishes old content — keep the active workshop in step.
    try { await workshopSync.pushBaseToActiveWorkshop(doc.data); }
    catch (syncErr) { console.error("[site-config/revert] workshop sync failed:", syncErr.message); }
    return res.json({ status: "success", version: doc.version, restoredFrom: version });
  } catch (err) {
    console.error("[site-config/revert] error:", err.message);
    return res.status(500).json({ status: "error", message: "Could not revert" });
  }
}

module.exports = { getPublic, getDraft, saveDraft, publish, discardDraft, history, revert };
