"use strict";
const archiver = require("archiver");
const config = require("../config");
const Certificate = require("../models/Certificate");
const CertificateTemplate = require("../models/CertificateTemplate");
const Registration = require("../models/Registration");
const commQueue = require("../services/commQueue");
const audit = require("../services/audit");
const { buildCertificatePdf } = require("../services/certificate");
const { randomToken } = require("../utils/password");
const { clean } = require("../utils/helpers");

const rx = (s) => new RegExp(String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
const verifyBase = () => process.env.CERT_VERIFY_URL || `${config.storage.publicBaseUrl}/verify`;
const verifyUrlFor = (c) => `${verifyBase()}?n=${encodeURIComponent(c.certificateNumber)}&t=${encodeURIComponent(c.verifyToken)}`;

async function nextNumber() {
  const year = new Date().getFullYear();
  const seq = (await Certificate.countDocuments({})) + 1;
  return `YW-${year}-${String(seq).padStart(6, "0")}`;
}

/* -------- template -------- */
async function getTemplate(req, res) { return res.json({ status: "success", template: await CertificateTemplate.getSingleton() }); }
async function updateTemplate(req, res) {
  try {
    const doc = await CertificateTemplate.getSingleton();
    const allow = ["title", "subtitle", "bodyText", "orientation", "instructor", "logo", "background", "signature", "seal", "primaryColor", "accentColor"];
    for (const k of allow) if (req.body[k] !== undefined) doc[k] = req.body[k];
    await doc.save();
    await audit.record(req, "certificate.template", { resource: "events" });
    return res.json({ status: "success", template: doc });
  } catch (err) { return res.status(500).json({ status: "error", message: "Could not save template" }); }
}

/* -------- issue -------- */
async function issueFor(reg, req, { force } = {}) {
  const eligible = force || reg.attended || reg.checkedInAt || reg.paymentStatus === "Paid";
  if (!eligible) return { skipped: "not eligible" };
  const existing = await Certificate.findOne({ registrationId: reg._id, status: "valid" });
  if (existing) return { certificate: existing, existed: true };
  const cert = await Certificate.create({
    certificateNumber: await nextNumber(), verifyToken: randomToken().slice(0, 24),
    registrationId: reg._id, regId: reg.regId, participantName: reg.fullName, workshop: reg.workshop,
    workshopDate: "", instructor: (await CertificateTemplate.getSingleton()).instructor || "",
    issuedBy: req.user ? req.user.id : null,
  });
  reg.certificateIssued = true; await reg.save();
  return { certificate: cert };
}

async function generate(req, res) {
  try {
    const reg = await Registration.findById((req.body || {}).registrationId);
    if (!reg) return res.status(404).json({ status: "error", message: "Registration not found" });
    const r = await issueFor(reg, req, { force: !!req.body.force });
    if (r.skipped) return res.status(400).json({ status: "error", message: "Not eligible — must have attended or paid (use force)" });
    if (!r.existed) await audit.record(req, "certificate.issue", { resource: "events", targetId: r.certificate._id, newValue: { number: r.certificate.certificateNumber } });
    return res.json({ status: "success", certificate: r.certificate, existed: !!r.existed });
  } catch (err) { console.error("[cert/generate]", err.message); return res.status(500).json({ status: "error", message: "Could not generate certificate" }); }
}

async function bulkGenerate(req, res) {
  try {
    const b = req.body || {};
    let filter;
    if (Array.isArray(b.ids) && b.ids.length) filter = { _id: { $in: b.ids } };
    else if (b.audience === "paid") filter = { paymentStatus: "Paid" };
    else filter = { checkedInAt: { $ne: null } }; // default: attended
    const regs = await Registration.find(filter).limit(20000);
    let created = 0;
    for (const reg of regs) { const r = await issueFor(reg, req, { force: !!b.force }); if (r.certificate && !r.existed) created += 1; }
    await audit.record(req, "certificate.bulk_issue", { resource: "events", newValue: { created } });
    return res.json({ status: "success", created });
  } catch (err) { console.error("[cert/bulk]", err.message); return res.status(500).json({ status: "error", message: "Bulk generate failed" }); }
}

async function list(req, res) {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.workshop) filter.workshop = req.query.workshop;
    if (req.query.q) filter.$or = [{ participantName: rx(req.query.q) }, { certificateNumber: rx(req.query.q) }, { regId: rx(req.query.q) }];
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "25", 10), 1), 200);
    const [items, total] = await Promise.all([
      Certificate.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Certificate.countDocuments(filter),
    ]);
    return res.json({ status: "success", items, page, limit, total, pages: Math.ceil(total / limit) });
  } catch (err) { return res.status(500).json({ status: "error", message: "Could not list certificates" }); }
}

async function download(req, res) {
  try {
    const cert = await Certificate.findById(req.params.id).lean();
    if (!cert) return res.status(404).json({ status: "error", message: "Not found" });
    const tpl = await CertificateTemplate.getSingleton();
    const buf = await buildCertificatePdf(cert, tpl, verifyUrlFor(cert));
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${cert.certificateNumber}.pdf"`);
    return res.send(buf);
  } catch (err) { console.error("[cert/download]", err.message); return res.status(500).json({ status: "error", message: "Could not render certificate" }); }
}

async function downloadZip(req, res) {
  try {
    const ids = (req.body && req.body.ids) || [];
    const filter = ids.length ? { _id: { $in: ids } } : { status: "valid" };
    const certs = await Certificate.find(filter).limit(2000).lean();
    const tpl = await CertificateTemplate.getSingleton();
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="certificates-${new Date().toISOString().slice(0, 10)}.zip"`);
    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", (e) => { throw e; });
    archive.pipe(res);
    for (const c of certs) { const buf = await buildCertificatePdf(c, tpl, verifyUrlFor(c)); archive.append(buf, { name: `${c.certificateNumber}.pdf` }); }
    await audit.record(req, "certificate.zip", { resource: "events", newValue: { count: certs.length } });
    await archive.finalize();
  } catch (err) { console.error("[cert/zip]", err.message); if (!res.headersSent) res.status(500).json({ status: "error", message: "ZIP failed" }); }
}

/** PUBLIC verify — by number+token, or by registration id. No secrets returned. */
async function verify(req, res) {
  try {
    const number = clean(req.query.n);
    const token = clean(req.query.t);
    const regId = clean(req.query.regId);
    let cert = null;
    if (number) { cert = await Certificate.findOne({ certificateNumber: number }).lean(); if (cert && token && cert.verifyToken !== token) cert = null; }
    else if (regId) { cert = await Certificate.findOne({ regId, status: "valid" }).sort({ createdAt: -1 }).lean(); }
    if (!cert) return res.json({ status: "success", result: "not_found" });
    return res.json({
      status: "success",
      result: cert.status === "revoked" ? "revoked" : "valid",
      certificate: { number: cert.certificateNumber, participant: cert.participantName, workshop: cert.workshop, issueDate: cert.issueDate, status: cert.status },
    });
  } catch (err) { return res.status(500).json({ status: "error", message: "Verification failed" }); }
}

async function revoke(req, res) {
  try {
    const cert = await Certificate.findById(req.params.id);
    if (!cert) return res.status(404).json({ status: "error", message: "Not found" });
    cert.status = "revoked"; cert.revokedAt = new Date(); cert.revokedReason = clean((req.body || {}).reason);
    await cert.save();
    await Registration.updateOne({ _id: cert.registrationId }, { $set: { certificateIssued: false } });
    await audit.record(req, "certificate.revoke", { resource: "events", targetId: cert._id, newValue: { number: cert.certificateNumber } });
    return res.json({ status: "success", certificate: cert });
  } catch (err) { return res.status(500).json({ status: "error", message: "Could not revoke" }); }
}

async function reissue(req, res) {
  try {
    const old = await Certificate.findById(req.params.id);
    if (!old) return res.status(404).json({ status: "error", message: "Not found" });
    old.status = "revoked"; old.revokedAt = new Date(); old.revokedReason = "reissued"; await old.save();
    const cert = await Certificate.create({
      certificateNumber: await nextNumber(), verifyToken: randomToken().slice(0, 24),
      registrationId: old.registrationId, regId: old.regId, participantName: old.participantName,
      workshop: old.workshop, workshopDate: old.workshopDate, instructor: old.instructor,
      issuedBy: req.user ? req.user.id : null, reissuedFrom: old.certificateNumber,
    });
    await Registration.updateOne({ _id: cert.registrationId }, { $set: { certificateIssued: true } });
    await audit.record(req, "certificate.reissue", { resource: "events", targetId: cert._id, newValue: { from: old.certificateNumber, to: cert.certificateNumber } });
    return res.json({ status: "success", certificate: cert });
  } catch (err) { return res.status(500).json({ status: "error", message: "Could not reissue" }); }
}

/** Queue a certificate email (or WhatsApp) with the PDF attached. */
async function sendCertificate(req, res) {
  try {
    const cert = await Certificate.findById(req.params.id).lean();
    if (!cert) return res.status(404).json({ status: "error", message: "Not found" });
    const reg = await Registration.findById(cert.registrationId).lean();
    if (!reg || !reg.email) return res.status(400).json({ status: "error", message: "No recipient email" });
    await commQueue.enqueue({
      channel: "email", to: reg.email, name: reg.fullName, registrationId: reg._id, trigger: "certificate.ready",
      subject: `Your certificate for ${cert.workshop || "the workshop"}`,
      body: `<p>Hi ${reg.fullName || "there"},</p><p>Congratulations! Your certificate (${cert.certificateNumber}) is attached.</p>`,
      attachments: [{ filename: `${cert.certificateNumber}.pdf`, kind: "certificate", ref: String(cert._id) }],
      createdBy: req.user.id,
    });
    await audit.record(req, "certificate.email", { resource: "events", targetId: cert._id });
    return res.json({ status: "success", message: "Certificate email queued" });
  } catch (err) { return res.status(500).json({ status: "error", message: "Could not queue certificate email" }); }
}

module.exports = { getTemplate, updateTemplate, generate, bulkGenerate, list, download, downloadZip, verify, revoke, reissue, sendCertificate };
