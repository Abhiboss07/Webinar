"use strict";
/**
 * SiteConfig — the whole editable website content, stored as one document.
 *
 * WHY ONE DOCUMENT (for now): the public site already consumes a single nested
 * config object (the old config/workshop-config.js). Storing that exact shape in
 * `data` lets the frontend switch from a bundled file to `GET /api/site-config`
 * with ZERO shape changes and no risk to the live UI. Later phases split hot
 * collections (Trainers, FAQs, Testimonials, Registrations…) into their own
 * models; this document stays the source of truth for site-wide content.
 *
 * SECURITY: `data` holds ONLY values that were already shipped to the browser
 * (public Razorpay key id, public sheets read endpoint, copy, images). No
 * secrets live here — the Razorpay key SECRET and sheet token stay in env.
 */
const { mongoose } = require("../db/connect");

const siteConfigSchema = new mongoose.Schema(
  {
    // Singleton key so there is exactly one active config document.
    key: { type: String, required: true, unique: true, default: "default", index: true },
    // The full nested content object (same shape as the old workshop-config.js).
    data: { type: mongoose.Schema.Types.Mixed, required: true, default: {} },
    // Audit trail.
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    version: { type: Number, default: 1 },
  },
  { timestamps: true, minimize: false }
);

/** Fetch (or lazily create) the singleton config document. */
siteConfigSchema.statics.getSingleton = async function () {
  let doc = await this.findOne({ key: "default" });
  if (!doc) doc = await this.create({ key: "default", data: {} });
  return doc;
};

module.exports = mongoose.model("SiteConfig", siteConfigSchema);
