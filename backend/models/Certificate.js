"use strict";
/** Certificate — an issued certificate record. The PDF is generated on demand
 *  from the template + this data; only metadata + status live here. */
const { mongoose } = require("../db/connect");

const certSchema = new mongoose.Schema(
  {
    certificateNumber: { type: String, required: true, unique: true, index: true }, // e.g. YW-2026-000001
    verifyToken: { type: String, required: true },  // random; part of the verify URL
    registrationId: { type: mongoose.Schema.Types.ObjectId, ref: "Registration", required: true, index: true },
    regId: { type: String, default: "" },
    participantName: { type: String, default: "" },
    workshop: { type: String, default: "" },
    workshopDate: { type: String, default: "" },
    instructor: { type: String, default: "" },
    issueDate: { type: Date, default: Date.now },
    status: { type: String, enum: ["valid", "revoked"], default: "valid", index: true },
    revokedAt: { type: Date, default: null },
    revokedReason: { type: String, default: "" },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reissuedFrom: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Certificate", certSchema);
