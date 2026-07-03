"use strict";
/** Role — a named set of permissions ({ resource: { action: true } }). System
 *  roles are seeded and cannot be deleted; Super Admin bypasses checks. */
const { mongoose } = require("../db/connect");

const roleSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    permissions: { type: mongoose.Schema.Types.Mixed, default: {} },
    system: { type: Boolean, default: false },      // cannot be deleted
    isSuperAdmin: { type: Boolean, default: false }, // bypasses all checks
  },
  { timestamps: true, minimize: false }
);

module.exports = mongoose.model("Role", roleSchema);
