"use strict";
const crypto = require("crypto");
const Media = require("../models/Media");
const storage = require("../services/storage");
const mediaUsage = require("../services/mediaUsage");

const ALLOWED = new Set([
  "image/png", "image/jpeg", "image/webp", "image/gif", "image/svg+xml",
  "video/mp4", "video/webm", "application/pdf",
]);

const sanitizeFolder = (f) => (String(f || "general").toLowerCase().replace(/[^a-z0-9-_]+/g, "-").replace(/^-+|-+$/g, "") || "general");
const sha256 = (buf) => crypto.createHash("sha256").update(buf).digest("hex");

/** GET /api/media — search / filter / paginate, with per-item usage counts. */
async function list(req, res) {
  try {
    const q = String(req.query.q || "").trim();
    const type = String(req.query.type || "").trim();
    const folder = String(req.query.folder || "").trim();
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "24", 10), 1), 100);

    const filter = {};
    if (type) filter.resourceType = type;
    if (folder) filter.folder = folder;
    if (q) filter.$or = [
      { originalFilename: new RegExp(q, "i") },
      { altText: new RegExp(q, "i") },
      { tags: new RegExp(q, "i") },
    ];

    const [items, total, folders] = await Promise.all([
      Media.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Media.countDocuments(filter),
      Media.distinct("folder"),
    ]);

    // Usage counts: scan the single SiteConfig JSON once for this page's URLs.
    const SiteConfig = require("../models/SiteConfig");
    const doc = await SiteConfig.getSingleton();
    const hay = JSON.stringify(doc.data || {}) + JSON.stringify(doc.draft || {});
    const withUsage = items.map((m) => ({ ...m, usageCount: m.secureUrl ? hay.split(m.secureUrl).length - 1 : 0 }));

    return res.json({
      status: "success",
      items: withUsage,
      page, limit, total, pages: Math.ceil(total / limit),
      folders: folders.sort(),
      provider: storage.provider(),
    });
  } catch (err) {
    console.error("[media/list] error:", err.message);
    return res.status(500).json({ status: "error", message: "Could not list media" });
  }
}

/** POST /api/media — upload (multipart 'file'). Dedupes by checksum. */
async function upload(req, res) {
  try {
    if (!req.file) return res.status(400).json({ status: "error", message: "No file provided" });
    const { buffer, mimetype, originalname } = req.file;
    if (!ALLOWED.has(mimetype)) return res.status(400).json({ status: "error", message: `Unsupported file type: ${mimetype}` });

    const folder = sanitizeFolder(req.body.folder);
    const checksum = sha256(buffer);

    // Duplicate detection — return the existing asset unless caller opts out.
    if (String(req.query.allowDuplicate || "") !== "1") {
      const existing = await Media.findOne({ checksum });
      if (existing) return res.json({ status: "success", duplicate: true, media: existing });
    }

    const resourceType = storage.resourceTypeFor(mimetype);
    const up = await storage.upload(buffer, { filename: originalname, mimetype, folder, resourceType });

    const media = await Media.create({
      ...up,
      originalFilename: originalname,
      folder,
      altText: String(req.body.altText || ""),
      tags: String(req.body.tags || "").split(",").map((t) => t.trim()).filter(Boolean),
      checksum,
      uploadedBy: req.user ? req.user.id : null,
    });
    return res.status(201).json({ status: "success", duplicate: false, media });
  } catch (err) {
    console.error("[media/upload] error:", err.message);
    return res.status(500).json({ status: "error", message: err.message || "Upload failed" });
  }
}

/** GET /api/media/:id — detail + live usage count. */
async function getOne(req, res) {
  try {
    const media = await Media.findById(req.params.id).lean();
    if (!media) return res.status(404).json({ status: "error", message: "Not found" });
    const usageCount = await mediaUsage.countUsage(media.secureUrl);
    return res.json({ status: "success", media: { ...media, usageCount } });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Could not load asset" });
  }
}

/** PATCH /api/media/:id — edit altText / folder / tags. */
async function patch(req, res) {
  try {
    const media = await Media.findById(req.params.id);
    if (!media) return res.status(404).json({ status: "error", message: "Not found" });
    if (req.body.altText != null) media.altText = String(req.body.altText);
    if (req.body.folder != null) media.folder = sanitizeFolder(req.body.folder);
    if (req.body.tags != null) media.tags = String(req.body.tags).split(",").map((t) => t.trim()).filter(Boolean);
    await media.save();
    return res.json({ status: "success", media });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Could not update asset" });
  }
}

/** POST /api/media/:id/replace — swap the file, keep the id, propagate the URL. */
async function replace(req, res) {
  try {
    if (!req.file) return res.status(400).json({ status: "error", message: "No file provided" });
    const media = await Media.findById(req.params.id);
    if (!media) return res.status(404).json({ status: "error", message: "Not found" });
    const { buffer, mimetype, originalname } = req.file;
    if (!ALLOWED.has(mimetype)) return res.status(400).json({ status: "error", message: `Unsupported file type: ${mimetype}` });

    const oldSecure = media.secureUrl;
    const oldUrl = media.url;
    const oldPublicId = media.publicId;
    const oldResourceType = media.resourceType;

    const resourceType = storage.resourceTypeFor(mimetype);
    const up = await storage.upload(buffer, { filename: originalname, mimetype, folder: media.folder, resourceType });

    // Point the CMS at the new URL everywhere the old one appeared.
    let replaced = await mediaUsage.propagateReplace(oldSecure, up.secureUrl);
    if (oldUrl && oldUrl !== oldSecure) replaced += await mediaUsage.propagateReplace(oldUrl, up.secureUrl);

    Object.assign(media, up, { originalFilename: originalname, checksum: sha256(buffer) });
    await media.save();

    // Best-effort cleanup of the old blob.
    try { await storage.destroy(oldPublicId, oldResourceType); } catch (_) { /* ignore */ }

    return res.json({ status: "success", media, replaced });
  } catch (err) {
    console.error("[media/replace] error:", err.message);
    return res.status(500).json({ status: "error", message: err.message || "Replace failed" });
  }
}

/** DELETE /api/media/:id — blocked if in use unless ?force=1. */
async function remove(req, res) {
  try {
    const media = await Media.findById(req.params.id);
    if (!media) return res.status(404).json({ status: "error", message: "Not found" });
    const usageCount = await mediaUsage.countUsage(media.secureUrl);
    if (usageCount > 0 && String(req.query.force || "") !== "1") {
      return res.status(409).json({ status: "error", message: `Asset is used in ${usageCount} place(s). Confirm to delete anyway.`, usageCount });
    }
    try { await storage.destroy(media.publicId, media.resourceType); } catch (_) { /* ignore */ }
    await media.deleteOne();
    return res.json({ status: "success", usageCount });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Could not delete asset" });
  }
}

module.exports = { list, upload, getOne, patch, replace, remove };
