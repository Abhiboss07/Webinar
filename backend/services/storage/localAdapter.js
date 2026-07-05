"use strict";
/**
 * Local-disk storage adapter (dev / fallback). Saves to config.storage.uploadDir
 * and serves via the /uploads static route mounted in app.js. Returns absolute
 * URLs (built from storage.publicBaseUrl) so the separately-hosted site can load
 * them. No image optimisation/resize here — that's Cloudinary's job in prod; the
 * admin still downsizes very large images client-side before upload.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const config = require("../../config");
const { imageSize } = require("../../utils/imageSize");

const ROOT = path.resolve(process.cwd(), config.storage.uploadDir);

function extFrom(filename, mimetype) {
  const e = (path.extname(filename || "") || "").replace(".", "").toLowerCase();
  if (e) return e;
  const map = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "application/pdf": "pdf", "video/mp4": "mp4" };
  return map[mimetype] || "bin";
}

async function upload(buffer, { filename, mimetype, folder, resourceType }) {
  const dir = path.join(ROOT, folder || "general");
  fs.mkdirSync(dir, { recursive: true });
  const ext = extFrom(filename, mimetype);
  const id = crypto.randomBytes(8).toString("hex");
  const key = `${folder || "general"}/${id}.${ext}`;
  fs.writeFileSync(path.join(ROOT, key), buffer);

  const url = `${config.storage.publicBaseUrl}/uploads/${key}`;
  const dims = resourceType === "image" ? imageSize(buffer) : null;
  return {
    provider: "local",
    publicId: key,
    url,
    secureUrl: url,
    thumbUrl: url, // no server-side resize locally
    resourceType,
    format: ext,
    bytes: buffer.length,
    width: dims ? dims.width : 0,
    height: dims ? dims.height : 0,
  };
}

async function destroy(publicId) {
  const p = path.join(ROOT, publicId);
  if (p.startsWith(ROOT) && fs.existsSync(p)) fs.unlinkSync(p);
}

module.exports = { upload, destroy, kind: "local" };
