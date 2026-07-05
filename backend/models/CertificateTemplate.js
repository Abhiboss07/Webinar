"use strict";
/** CertificateTemplate — the (singleton) design used to render certificate PDFs. */
const { mongoose } = require("../db/connect");

const schema = new mongoose.Schema(
  {
    key: { type: String, default: "default", unique: true },
    title: { type: String, default: "Certificate of Participation" },
    subtitle: { type: String, default: "This is proudly presented to" },
    bodyText: { type: String, default: "for participating in {{workshop}} held on {{date}}." },
    orientation: { type: String, enum: ["landscape", "portrait"], default: "landscape" },
    instructor: { type: String, default: "" },
    logo: { type: String, default: "" },
    background: { type: String, default: "" },
    signature: { type: String, default: "" },
    seal: { type: String, default: "" },
    primaryColor: { type: String, default: "#1e3d52" },
    accentColor: { type: String, default: "#c8862b" },
  },
  { timestamps: true, minimize: false }
);
schema.statics.getSingleton = async function () {
  let d = await this.findOne({ key: "default" });
  if (!d) d = await this.create({ key: "default" });
  return d;
};
module.exports = mongoose.model("CertificateTemplate", schema);
