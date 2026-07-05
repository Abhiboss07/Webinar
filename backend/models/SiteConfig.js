"use strict";
/**
 * SiteConfig — the whole editable website content, stored as one document.
 *
 * WHY ONE DOCUMENT (for now): the public site already consumes a single nested
 * config object (the old config/workshop-config.js). Storing that exact shape in
 * `data` lets the frontend switch from a bundled file to `GET /api/site-config`
 * with ZERO shape changes. Later phases split hot collections (Registrations,
 * Media…) into their own models; this document stays the source of truth for
 * site-wide content.
 *
 * DRAFT / PUBLISH (added in Module 2.2):
 *   • data   = PUBLISHED content — what the public site serves.
 *   • draft  = editable working copy — admin edits autosave here.
 *   • history= capped snapshots of previously-published `data` for revert.
 * Public GET returns `data`; `?preview=1` returns `draft`. Publish promotes
 * draft → data (snapshotting the old data into history first).
 *
 * SECURITY: `data`/`draft` hold ONLY values already shipped to the browser
 * (public Razorpay key id, public sheets read endpoint, copy, images). No
 * secrets live here — the Razorpay key SECRET and sheet token stay in env.
 */
const { mongoose } = require("../db/connect");

const historySchema = new mongoose.Schema(
  {
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    version: { type: Number, required: true },
    publishedAt: { type: Date, default: Date.now },
    publishedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { _id: false }
);

const siteConfigSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: "default", index: true },
    // Published content (public site reads this).
    data: { type: mongoose.Schema.Types.Mixed, required: true, default: {} },
    // Working copy (admin edits autosave here). null → falls back to `data`.
    draft: { type: mongoose.Schema.Types.Mixed, default: null },
    // Capped snapshots of previously-published data (newest first).
    history: { type: [historySchema], default: [] },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    version: { type: Number, default: 1 },
    publishedAt: { type: Date, default: Date.now },
    draftUpdatedAt: { type: Date, default: null },
  },
  { timestamps: true, minimize: false }
);

const HISTORY_CAP = 15;
siteConfigSchema.statics.HISTORY_CAP = HISTORY_CAP;

/** Fetch (or lazily create) the singleton config document. */
siteConfigSchema.statics.getSingleton = async function () {
  let doc = await this.findOne({ key: "default" });
  if (!doc) doc = await this.create({ key: "default", data: {} });
  return doc;
};

module.exports = mongoose.model("SiteConfig", siteConfigSchema);
