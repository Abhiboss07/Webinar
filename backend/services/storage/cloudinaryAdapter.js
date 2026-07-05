"use strict";
/**
 * Cloudinary storage adapter (production). Uploads from a memory buffer via an
 * upload_stream, lets Cloudinary optimise (f_auto,q_auto) and derives a square
 * thumbnail transformation. Requires CLOUDINARY_* env (see .env.example).
 */
const { v2: cloudinary } = require("cloudinary");
const config = require("../../config");
const provider = require("../settingsProvider");

// Credentials come from the settings provider (admin-managed) → env fallback.
async function ensureConfig() {
  const c = await provider.cloudinary();
  if (!c.cloudName || !c.apiKey || !c.apiSecret) {
    throw new Error("Cloudinary is not configured (set it in Settings → Media, or CLOUDINARY_* env)");
  }
  cloudinary.config({ cloud_name: c.cloudName, api_key: c.apiKey, api_secret: c.apiSecret, secure: true });
  return c;
}

function thumbFor(publicId, resourceType) {
  if (resourceType === "raw") return "";
  return cloudinary.url(publicId, {
    resource_type: resourceType === "video" ? "video" : "image",
    format: resourceType === "video" ? "jpg" : undefined,
    transformation: [{ width: 300, height: 300, crop: "fill", gravity: "auto", quality: "auto", fetch_format: "auto" }],
    secure: true,
  });
}

async function upload(buffer, { filename, folder, resourceType }) {
  const c = await ensureConfig(); // rejects if unconfigured
  const fullFolder = [c.baseFolder, folder || "general"].filter(Boolean).join("/");
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: fullFolder,
        resource_type: resourceType === "raw" ? "raw" : resourceType, // image|video|raw
        use_filename: true,
        unique_filename: true,
        overwrite: false,
      },
      (err, r) => {
        if (err || !r) return reject(err || new Error("Cloudinary upload failed"));
        resolve({
          provider: "cloudinary",
          publicId: r.public_id,
          url: r.url,
          secureUrl: r.secure_url,
          thumbUrl: thumbFor(r.public_id, resourceType),
          resourceType,
          format: r.format || "",
          bytes: r.bytes || buffer.length,
          width: r.width || 0,
          height: r.height || 0,
        });
      }
    );
    stream.end(buffer);
  });
}

async function destroy(publicId, resourceType = "image") {
  await ensureConfig();
  await cloudinary.uploader.destroy(publicId, { resource_type: resourceType === "raw" ? "raw" : resourceType });
}

module.exports = { upload, destroy, kind: "cloudinary" };
