"use strict";
/**
 * Site content API. The public site reads GET /api/site-config; the admin reads
 * the same and writes with PUT /api/site-config (auth required).
 *
 * The stored `data` object is the same shape the frontend already renders, so
 * the browser needs no transformation — it interpolates {{tokens}} client-side
 * exactly as before.
 */
const SiteConfig = require("../models/SiteConfig");

/** Public: full editable content object. Cached briefly at the edge/browser. */
async function getPublic(req, res) {
  try {
    const doc = await SiteConfig.getSingleton();
    // Short cache so content edits show up quickly but repeat loads are cheap.
    res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
    return res.json({ status: "success", data: doc.data || {}, updatedAt: doc.updatedAt });
  } catch (err) {
    console.error("[site-config/get] error:", err.message);
    return res.status(500).json({ status: "error", message: "Could not load site content" });
  }
}

/** Admin: replace the whole content object (autosave-friendly full-document PUT). */
async function update(req, res) {
  try {
    const incoming = req.body && req.body.data;
    if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
      return res.status(400).json({ status: "error", message: "Body must be { data: { ... } }" });
    }
    const doc = await SiteConfig.getSingleton();
    doc.data = incoming;
    doc.updatedBy = req.user ? req.user.id : null;
    doc.version = (doc.version || 1) + 1;
    doc.markModified("data"); // Mixed type needs an explicit dirty flag
    await doc.save();
    return res.json({ status: "success", data: doc.data, version: doc.version, updatedAt: doc.updatedAt });
  } catch (err) {
    console.error("[site-config/update] error:", err.message);
    return res.status(500).json({ status: "error", message: "Could not save site content" });
  }
}

module.exports = { getPublic, update };
