"use strict";
/** Message — one queued/sent communication (the queue AND the history). */
const { mongoose } = require("../db/connect");

const messageSchema = new mongoose.Schema(
  {
    channel: { type: String, enum: ["email", "whatsapp"], required: true, index: true },
    to: { type: String, required: true },        // email address or phone
    name: { type: String, default: "" },
    registrationId: { type: mongoose.Schema.Types.ObjectId, ref: "Registration", default: null, index: true },
    templateKey: { type: String, default: "" },
    trigger: { type: String, default: "manual", index: true },

    subject: { type: String, default: "" },
    body: { type: String, default: "" },         // rendered content
    attachments: { type: [{ filename: String, kind: String, ref: String }], default: [] },

    status: { type: String, enum: ["queued", "sending", "sent", "delivered", "failed", "cancelled"], default: "queued", index: true },
    scheduledFor: { type: Date, default: Date.now, index: true },
    sentAt: { type: Date, default: null },
    retries: { type: Number, default: 0 },
    maxRetries: { type: Number, default: 3 },
    error: { type: String, default: "" },
    providerResult: { type: mongoose.Schema.Types.Mixed, default: null },

    // Engagement (email) — updated by the tracking pixel / link redirect.
    opens: { type: Number, default: 0 },
    clicks: { type: Number, default: 0 },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);
messageSchema.index({ status: 1, scheduledFor: 1 });

module.exports = mongoose.model("Message", messageSchema);
