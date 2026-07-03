"use strict";
/** MessageTemplate — an email or WhatsApp template with {{variables}}. Bound to
 *  a trigger event (or "manual"). Keeps capped version history for rollback. */
const { mongoose } = require("../db/connect");

const templateSchema = new mongoose.Schema(
  {
    channel: { type: String, enum: ["email", "whatsapp"], required: true, index: true },
    key: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    category: { type: String, default: "general" },
    trigger: { type: String, default: "manual", index: true }, // event name or "manual"
    enabled: { type: Boolean, default: true },

    // Email
    subject: { type: String, default: "" },
    body: { type: String, default: "" }, // HTML (email) or text (whatsapp)

    // WhatsApp extras
    whatsapp: {
      header: { type: String, default: "" },
      footer: { type: String, default: "" },
      mediaUrl: { type: String, default: "" },
      buttons: { type: [{ text: String, url: String }], default: [] },
    },

    version: { type: Number, default: 1 },
    history: { type: [{ subject: String, body: String, at: { type: Date, default: Date.now }, by: String }], default: [] },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, minimize: false }
);

module.exports = mongoose.model("MessageTemplate", templateSchema);
