"use strict";
const Registration = require("../models/Registration");
const Certificate = require("../models/Certificate");
const qrToken = require("../services/qrToken");
const audit = require("../services/audit");
const { clean } = require("../utils/helpers");

const rx = (s) => new RegExp(String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

async function dashboard(req, res) {
  try {
    const [total, checkedIn, paid, certs] = await Promise.all([
      Registration.countDocuments({}),
      Registration.countDocuments({ checkedInAt: { $ne: null } }),
      Registration.countDocuments({ paymentStatus: "Paid" }),
      Certificate.countDocuments({ status: "valid" }),
    ]);
    const recent = await Registration.find({ checkedInAt: { $ne: null } }).sort({ checkedInAt: -1 }).limit(10).select("fullName workshop checkedInAt checkinBy").lean();
    return res.json({
      status: "success",
      cards: {
        total, checkedIn, absent: Math.max(paid - checkedIn, 0), pending: total - checkedIn,
        certificatesIssued: certs, completionRate: checkedIn ? Math.round((certs / checkedIn) * 1000) / 10 : 0,
      },
      recent,
    });
  } catch (err) { return res.status(500).json({ status: "error", message: "Could not load attendance" }); }
}

async function analytics(req, res) {
  try {
    const [total, checkedIn, certs, byWorkshop, arrivals] = await Promise.all([
      Registration.countDocuments({}),
      Registration.countDocuments({ checkedInAt: { $ne: null } }),
      Certificate.countDocuments({ status: "valid" }),
      Registration.aggregate([{ $group: { _id: "$workshop", registered: { $sum: 1 }, attended: { $sum: { $cond: [{ $ne: ["$checkedInAt", null] }, 1, 0] } } } }, { $sort: { registered: -1 } }, { $limit: 8 }]),
      Registration.aggregate([{ $match: { checkedInAt: { $ne: null } } }, { $group: { _id: null, avgHour: { $avg: { $hour: { date: "$checkedInAt", timezone: "+05:30" } } } } }]),
    ]);
    return res.json({
      status: "success",
      attendanceRate: total ? Math.round((checkedIn / total) * 1000) / 10 : 0,
      noShowRate: total ? Math.round(((total - checkedIn) / total) * 1000) / 10 : 0,
      completionRate: checkedIn ? Math.round((certs / checkedIn) * 1000) / 10 : 0,
      certificatesIssued: certs,
      avgArrivalHour: arrivals[0] ? Math.round(arrivals[0].avgHour * 10) / 10 : null,
      byWorkshop: byWorkshop.map((w) => ({ label: w._id || "—", count: w.attended, registered: w.registered })),
    });
  } catch (err) { return res.status(500).json({ status: "error", message: "Could not load analytics" }); }
}

async function list(req, res) {
  try {
    const filter = {};
    if (req.query.workshop) filter.workshop = req.query.workshop;
    if (req.query.attendance === "in") filter.checkedInAt = { $ne: null };
    if (req.query.attendance === "out") filter.checkedInAt = null;
    if (req.query.q) filter.$or = [{ fullName: rx(req.query.q) }, { email: rx(req.query.q) }, { mobile: rx(req.query.q) }, { regId: rx(req.query.q) }];
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "25", 10), 1), 200);
    const [items, total] = await Promise.all([
      Registration.find(filter).sort({ checkedInAt: -1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).select("regId fullName email mobile workshop paymentStatus attended checkedInAt checkedOutAt checkinBy certificateIssued").lean(),
      Registration.countDocuments(filter),
    ]);
    return res.json({ status: "success", items, page, limit, total, pages: Math.ceil(total / limit) });
  } catch (err) { return res.status(500).json({ status: "error", message: "Could not list attendance" }); }
}

/** QR token + PNG for a registration (for badges / self-scan). */
async function qr(req, res) {
  try {
    const reg = await Registration.findById(req.params.id).lean();
    if (!reg) return res.status(404).json({ status: "error", message: "Not found" });
    const token = qrToken.makeToken(reg.regId);
    return res.json({ status: "success", token, dataUrl: await qrToken.dataUrl(token) });
  } catch (err) { return res.status(500).json({ status: "error", message: "Could not build QR" }); }
}

async function resolveReg(b) {
  if (b.token) { const t = qrToken.readToken(b.token); if (t) return Registration.findOne({ regId: t.regId }); return null; }
  if (b.id) return Registration.findById(b.id).catch(() => null);
  if (b.regId) return Registration.findOne({ regId: clean(b.regId) });
  return null;
}

async function checkin(req, res) {
  try {
    const b = req.body || {};
    const reg = await resolveReg(b);
    if (!reg) return res.status(404).json({ status: "error", message: "Registration not found / invalid QR" });
    if (reg.checkedInAt) return res.json({ status: "success", duplicate: true, message: "Already checked in", registration: reg.toObject() });
    reg.checkedInAt = new Date(); reg.attended = true;
    reg.checkinBy = (req.user && req.user.email) || "admin";
    reg.checkinDevice = clean(b.device); reg.checkinLocation = clean(b.location);
    reg.activity.push({ type: "checkin", detail: "Checked in", by: reg.checkinBy });
    await reg.save();
    await audit.record(req, "attendance.checkin", { resource: "events", targetId: reg._id, newValue: { regId: reg.regId } });
    return res.json({ status: "success", duplicate: false, registration: reg.toObject() });
  } catch (err) { console.error("[attendance/checkin]", err.message); return res.status(500).json({ status: "error", message: "Check-in failed" }); }
}

async function checkout(req, res) {
  try {
    const reg = await Registration.findById(req.params.id);
    if (!reg) return res.status(404).json({ status: "error", message: "Not found" });
    reg.checkedOutAt = new Date();
    reg.activity.push({ type: "checkout", detail: "Checked out", by: (req.user && req.user.email) || "admin" });
    await reg.save();
    return res.json({ status: "success", registration: reg.toObject() });
  } catch (err) { return res.status(500).json({ status: "error", message: "Check-out failed" }); }
}

module.exports = { dashboard, analytics, list, qr, checkin, checkout };
