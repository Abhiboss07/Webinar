"use strict";
/**
 * Workshop CRUD + lifecycle (create / duplicate / activate / publish / archive /
 * restore / delete). The public site reads the active workshop via the composed
 * /api/site-config; these endpoints are admin-only.
 */
const Workshop = require("../models/Workshop");
const audit = require("../services/audit");
const { clean, slugify } = require("../utils/helpers");

/** Ensure a slug is unique (append -2, -3… ), ignoring one id (for updates). */
async function uniqueSlug(base, ignoreId) {
  let slug = slugify(base);
  let n = 1;
  // eslint-disable-next-line no-await-in-loop
  while (await Workshop.exists({ slug, ...(ignoreId ? { _id: { $ne: ignoreId } } : {}) })) {
    n += 1; slug = `${slugify(base)}-${n}`;
  }
  return slug;
}

async function list(req, res) {
  try {
    const status = clean(req.query.status);
    const filter = status ? { status } : {};
    const docs = await Workshop.find(filter).sort({ isActive: -1, updatedAt: -1 });
    return res.json({ status: "success", workshops: docs.map((d) => d.summary()) });
  } catch (err) {
    console.error("[workshops/list]", err.message);
    return res.status(500).json({ status: "error", message: "Could not list workshops" });
  }
}

async function getOne(req, res) {
  try {
    const w = await Workshop.findById(req.params.id);
    if (!w) return res.status(404).json({ status: "error", message: "Workshop not found" });
    return res.json({ status: "success", workshop: w });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Could not load workshop" });
  }
}

async function create(req, res) {
  try {
    const b = req.body || {};
    const title = clean(b.title);
    if (!title) return res.status(400).json({ status: "error", message: "Title is required" });
    const slug = await uniqueSlug(b.slug || title);
    const w = await Workshop.create({
      title,
      subtitle: clean(b.subtitle),
      description: clean(b.description),
      category: clean(b.category),
      slug,
      status: "draft",
      content: (b.content && typeof b.content === "object" && !Array.isArray(b.content)) ? b.content : {},
      createdBy: req.user ? req.user.id : null,
    });
    return res.status(201).json({ status: "success", workshop: w });
  } catch (err) {
    console.error("[workshops/create]", err.message);
    return res.status(500).json({ status: "error", message: "Could not create workshop" });
  }
}

async function update(req, res) {
  try {
    const w = await Workshop.findById(req.params.id);
    if (!w) return res.status(404).json({ status: "error", message: "Workshop not found" });
    const b = req.body || {};
    if (b.title != null) w.title = clean(b.title);
    if (b.subtitle != null) w.subtitle = clean(b.subtitle);
    if (b.description != null) w.description = clean(b.description);
    if (b.category != null) w.category = clean(b.category);
    if (b.slug != null && slugify(b.slug) !== w.slug) w.slug = await uniqueSlug(b.slug, w._id);
    if (b.content != null) {
      if (typeof b.content !== "object" || Array.isArray(b.content)) return res.status(400).json({ status: "error", message: "content must be an object" });
      w.content = b.content; w.markModified("content");
    }
    await w.save();
    return res.json({ status: "success", workshop: w });
  } catch (err) {
    console.error("[workshops/update]", err.message);
    return res.status(500).json({ status: "error", message: "Could not save workshop" });
  }
}

async function duplicate(req, res) {
  try {
    const src = await Workshop.findById(req.params.id);
    if (!src) return res.status(404).json({ status: "error", message: "Workshop not found" });
    const slug = await uniqueSlug(`${src.slug}-copy`);
    const copy = await Workshop.create({
      title: `${src.title} (Copy)`,
      subtitle: src.subtitle, description: src.description, category: src.category,
      slug, status: "draft", isActive: false, scheduledFor: null,
      content: JSON.parse(JSON.stringify(src.content || {})),
      createdBy: req.user ? req.user.id : null,
    });
    return res.status(201).json({ status: "success", workshop: copy });
  } catch (err) {
    console.error("[workshops/duplicate]", err.message);
    return res.status(500).json({ status: "error", message: "Could not duplicate workshop" });
  }
}

/** Make this the active workshop (must be published). Unsets any other active. */
async function activate(req, res) {
  try {
    const w = await Workshop.findById(req.params.id);
    if (!w) return res.status(404).json({ status: "error", message: "Workshop not found" });
    if (w.status !== "published") return res.status(400).json({ status: "error", message: "Only a published workshop can be made active" });
    await Workshop.updateMany({ _id: { $ne: w._id }, isActive: true }, { $set: { isActive: false } });
    w.isActive = true;
    await w.save();
    return res.json({ status: "success", workshop: w.summary() });
  } catch (err) {
    console.error("[workshops/activate]", err.message);
    return res.status(500).json({ status: "error", message: "Could not activate workshop" });
  }
}

/** Change status: publish / unpublish (draft) / archive / restore. */
async function setStatus(req, res) {
  try {
    const w = await Workshop.findById(req.params.id);
    if (!w) return res.status(404).json({ status: "error", message: "Workshop not found" });
    const next = clean((req.body || {}).status);
    if (!["draft", "published", "archived"].includes(next)) return res.status(400).json({ status: "error", message: "Invalid status" });

    w.status = next;
    if (next === "published") {
      const s = (req.body || {}).scheduledFor;
      w.scheduledFor = s ? new Date(s) : null;
      w.archivedAt = null;
    } else {
      // Leaving published → it can no longer be the live/active workshop.
      w.isActive = false;
      if (next === "archived") w.archivedAt = new Date();
      if (next === "draft") { w.archivedAt = null; w.scheduledFor = null; }
    }
    await w.save();
    if (next === "published") await audit.record(req, "workshop.publish", { resource: "workshops", targetId: w._id, newValue: { slug: w.slug, scheduledFor: w.scheduledFor } });
    return res.json({ status: "success", workshop: w.summary() });
  } catch (err) {
    console.error("[workshops/setStatus]", err.message);
    return res.status(500).json({ status: "error", message: "Could not update status" });
  }
}

async function remove(req, res) {
  try {
    const w = await Workshop.findById(req.params.id);
    if (!w) return res.status(404).json({ status: "error", message: "Workshop not found" });
    if (w.isActive) return res.status(409).json({ status: "error", message: "This is the active workshop. Activate another (or archive this) before deleting." });
    await w.deleteOne();
    return res.json({ status: "success" });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Could not delete workshop" });
  }
}

module.exports = { list, getOne, create, update, duplicate, activate, setStatus, remove };
