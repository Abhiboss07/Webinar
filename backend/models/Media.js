"use strict";
/**
 * Media — one uploaded asset (image / video / pdf / icon …). Provider-agnostic:
 * the storage adapter (Cloudinary in prod, local disk in dev) fills in url/ids,
 * and this document is what the admin library lists and the CMS fields point at.
 *
 * `checksum` (sha256 of the bytes) powers duplicate detection — re-uploading the
 * same file returns the existing asset instead of creating a copy.
 */
const { mongoose } = require("../db/connect");

const mediaSchema = new mongoose.Schema(
  {
    provider: { type: String, enum: ["cloudinary", "local"], required: true },
    publicId: { type: String, required: true, index: true }, // storage key / cloudinary public_id
    url: { type: String, required: true },
    secureUrl: { type: String, required: true },
    thumbUrl: { type: String, default: "" },

    resourceType: { type: String, enum: ["image", "video", "raw"], default: "image", index: true },
    format: { type: String, default: "" },
    bytes: { type: Number, default: 0 },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },

    originalFilename: { type: String, default: "" },
    folder: { type: String, default: "general", index: true },
    altText: { type: String, default: "" },
    tags: { type: [String], default: [] },

    checksum: { type: String, default: "", index: true }, // sha256 for dedupe
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Media", mediaSchema);
