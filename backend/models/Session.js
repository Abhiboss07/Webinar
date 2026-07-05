"use strict";
/** Session — a refresh-token session (for session management + rotation). Only a
 *  SHA-256 hash of the refresh token is stored, never the token itself. */
const { mongoose } = require("../db/connect");

const sessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, index: true },
    userAgent: { type: String, default: "" },
    ip: { type: String, default: "" },
    lastUsedAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    revoked: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Session", sessionSchema);
