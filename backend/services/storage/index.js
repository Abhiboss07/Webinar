"use strict";
/**
 * Storage facade — selects the adapter from config.storage.provider so the rest
 * of the app is provider-agnostic. Cloudinary in production; local disk for dev
 * and as a safe fallback if Cloudinary isn't configured.
 */
const config = require("../../config");
const local = require("./localAdapter");
const cloudinary = require("./cloudinaryAdapter");

function adapter() {
  return config.storage.provider === "cloudinary" ? cloudinary : local;
}

/** Map a mime type to a Cloudinary-style resource type. */
function resourceTypeFor(mimetype) {
  if (/^image\//.test(mimetype)) return "image";
  if (/^video\//.test(mimetype)) return "video";
  return "raw"; // pdf, etc.
}

module.exports = {
  provider: () => adapter().kind,
  resourceTypeFor,
  upload: (buffer, opts) => adapter().upload(buffer, opts),
  destroy: (publicId, resourceType) => adapter().destroy(publicId, resourceType),
};
