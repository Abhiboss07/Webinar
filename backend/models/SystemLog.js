"use strict";
/** SystemLog — persisted application/error log lines (soft-capped by the logger). */
const { mongoose } = require("../db/connect");

const schema = new mongoose.Schema(
  {
    level: { type: String, enum: ["info", "warn", "error"], default: "info", index: true },
    category: { type: String, default: "app", index: true }, // app | api | upload | error | …
    message: { type: String, default: "" },
    meta: { type: mongoose.Schema.Types.Mixed, default: null },
    at: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false }
);

module.exports = mongoose.model("SystemLog", schema);
