"use strict";
/** AuditLog — an immutable record of a security/data-changing action. */
const { mongoose } = require("../db/connect");

const auditSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    userEmail: { type: String, default: "" },
    action: { type: String, required: true, index: true }, // e.g. "login", "user.create", "payment.refund"
    resource: { type: String, default: "" },
    targetId: { type: String, default: "" },
    ip: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    oldValue: { type: mongoose.Schema.Types.Mixed, default: null },
    newValue: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: "at", updatedAt: false } }
);
auditSchema.index({ at: -1 });

module.exports = mongoose.model("AuditLog", auditSchema);
