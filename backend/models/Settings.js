"use strict";
/** Settings — singleton holding all site/integration configuration. Secret
 *  values inside `data` are stored encrypted (see cryptoBox). `history` keeps
 *  capped snapshots for rollback. */
const { mongoose } = require("../db/connect");

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: "default", index: true },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    history: { type: [{ data: mongoose.Schema.Types.Mixed, at: { type: Date, default: Date.now }, by: String }], default: [] },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, minimize: false }
);

settingsSchema.statics.HISTORY_CAP = 15;
settingsSchema.statics.getSingleton = async function () {
  let doc = await this.findOne({ key: "default" });
  if (!doc) doc = await this.create({ key: "default", data: {} });
  return doc;
};

module.exports = mongoose.model("Settings", settingsSchema);
