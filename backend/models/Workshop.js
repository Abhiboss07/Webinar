"use strict";
/**
 * Workshop — a first-class, cloneable workshop entity (Module 2.4).
 *
 * The public site loads the single ACTIVE + published workshop and overlays its
 * `content` on top of the site-wide SiteConfig base (see siteConfigController).
 * `content` holds the workshop-owned top-level keys (workshop facts, hero, seo,
 * registration, modules/agenda, faq, testimonials, trainer, bonus, gallery,
 * certificates, sponsors…). Overlay is shallow per top-level key, so a partial
 * workshop only overrides what it defines and the rest falls back to SiteConfig.
 *
 * status: draft (hidden) | published (eligible to go live) | archived (hidden).
 * scheduledFor: when set, the workshop only counts as live from that time.
 * isActive: exactly one published workshop is the one the public site serves.
 */
const { mongoose } = require("../db/connect");

const workshopSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subtitle: { type: String, default: "" },
    description: { type: String, default: "" },
    slug: { type: String, required: true, unique: true, index: true },
    category: { type: String, default: "" },

    status: { type: String, enum: ["draft", "published", "archived"], default: "draft", index: true },
    isActive: { type: Boolean, default: false, index: true },
    scheduledFor: { type: Date, default: null },
    archivedAt: { type: Date, default: null },

    // The overlay slice (same shape as the matching SiteConfig keys).
    content: { type: mongoose.Schema.Types.Mixed, default: {} },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, minimize: false }
);

/** Is this workshop effectively live right now (published + schedule reached)? */
workshopSchema.methods.isLive = function () {
  return this.status === "published" && (!this.scheduledFor || this.scheduledFor <= new Date());
};

/** A compact summary for list views (reads a few facts out of content). */
workshopSchema.methods.summary = function () {
  const w = (this.content && this.content.workshop) || {};
  return {
    id: this._id,
    title: this.title,
    subtitle: this.subtitle,
    slug: this.slug,
    category: this.category,
    status: this.status,
    isActive: this.isActive,
    scheduledFor: this.scheduledFor,
    live: this.isLive(),
    date: w.date || "",
    time: w.time || "",
    venue: w.venue || "",
    price: w.price || "",
    updatedAt: this.updatedAt,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model("Workshop", workshopSchema);
