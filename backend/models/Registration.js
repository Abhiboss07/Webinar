"use strict";
/**
 * Registration — a workshop sign-up, mirrored into MongoDB.
 *
 * Google Sheets remains the primary record the client already relies on; this
 * model is written ALONGSIDE it (best-effort dual-write) so the admin dashboard,
 * analytics and (Phase 2.4) the Registration Manager have a queryable store.
 * A Sheets or Mongo hiccup never breaks the other — see the controllers.
 *
 * Keyed by regId (the id the browser generates and reuses across retries), so
 * writes are idempotent upserts — no duplicate rows when a user resumes payment.
 */
const { mongoose } = require("../db/connect");

const registrationSchema = new mongoose.Schema(
  {
    regId: { type: String, required: true, unique: true, index: true },
    fullName: { type: String, default: "" },
    mobile: { type: String, default: "", index: true },
    email: { type: String, default: "", lowercase: true, trim: true, index: true },
    profession: { type: String, default: "" },
    city: { type: String, default: "" },
    experience: { type: String, default: "" },
    mode: { type: String, default: "" },
    workshop: { type: String, default: "" },
    source: { type: String, default: "" },        // full URL the sign-up came from
    sourceHost: { type: String, default: "" },     // derived hostname (for breakdowns)

    paymentStatus: { type: String, enum: ["Pending", "Paid", "Failed"], default: "Pending", index: true },
    orderId: { type: String, default: "" },
    paymentId: { type: String, default: "" },
    paymentMethod: { type: String, default: "" },
    amount: { type: Number, default: 0 },          // rupees (for revenue sums)
    currency: { type: String, default: "INR" },
    transactionTime: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Registration", registrationSchema);
