"use strict";
/** Backup — a point-in-time snapshot of config/content (+ optional data). The
 *  JSON payload is stored inline (workshop-scale); `checksum` verifies integrity. */
const { mongoose } = require("../db/connect");

const backupSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["manual", "scheduled"], default: "manual" },
    collections: { type: [{ name: String, count: Number }], default: [] },
    includeData: { type: Boolean, default: false },
    size: { type: Number, default: 0 },      // bytes of the JSON payload
    checksum: { type: String, default: "" }, // sha256 of the payload
    verified: { type: Boolean, default: true },
    data: { type: String, default: "" }, // JSON string: { collectionName: [docs] }
    by: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Backup", backupSchema);
