"use strict";
/** CommState — singleton flags for the communication queue (pause/resume). */
const { mongoose } = require("../db/connect");

const schema = new mongoose.Schema(
  { key: { type: String, default: "default", unique: true }, paused: { type: Boolean, default: false } },
  { timestamps: true }
);
schema.statics.getSingleton = async function () {
  let d = await this.findOne({ key: "default" });
  if (!d) d = await this.create({ key: "default" });
  return d;
};
module.exports = mongoose.model("CommState", schema);
