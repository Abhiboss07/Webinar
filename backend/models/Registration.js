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

    // Payment truth (the live flow only ever writes Pending/Paid). Admin can also
    // set Failed / Cancelled / Refunded from the CRM. Extending the enum is
    // backward-compatible with existing documents.
    paymentStatus: { type: String, enum: ["Pending", "Paid", "Failed", "Cancelled", "Refunded"], default: "Pending", index: true },
    orderId: { type: String, default: "" },
    paymentId: { type: String, default: "" },
    paymentMethod: { type: String, default: "" },
    amount: { type: Number, default: 0 },          // rupees (for revenue sums)
    currency: { type: String, default: "INR" },
    transactionTime: { type: Date, default: null },

    // Refund tracking (Payment Manager). Set only via admin refund action.
    refundId: { type: String, default: "" },
    refundAmount: { type: Number, default: 0 },
    refundedAt: { type: Date, default: null },

    // CRM lifecycle flags (independent of payment truth).
    attended: { type: Boolean, default: false },
    certificateIssued: { type: Boolean, default: false },
    waitlisted: { type: Boolean, default: false },

    // Internal admin notes + activity timeline.
    notes: { type: [{ text: String, by: String, at: { type: Date, default: Date.now } }], default: [] },
    activity: { type: [{ type: { type: String }, detail: String, by: String, at: { type: Date, default: Date.now } }], default: [] },
  },
  { timestamps: true }
);

// Sorting/filtering indexes for the CRM grid.
registrationSchema.index({ createdAt: -1 });
registrationSchema.index({ workshop: 1 });
registrationSchema.index({ profession: 1 });

module.exports = mongoose.model("Registration", registrationSchema);
