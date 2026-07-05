"use strict";
/**
 * Registration Manager (CRM) — admin-only list / filter / detail / status /
 * notes / bulk / export over the Registration collection. Read/curate only; it
 * never touches the public sign-up or payment-verification write paths.
 */
const Registration = require("../models/Registration");
const audit = require("../services/audit");
const { buildCsv, buildXlsx } = require("../services/exportRegistrations");

const SORTABLE = new Set(["createdAt", "fullName", "paymentStatus", "amount"]);
const STATUSES = ["Pending", "Paid", "Failed", "Cancelled", "Refunded"];
const rx = (s) => new RegExp(String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

/** Translate query params into a Mongo filter (shared by list + export). */
function buildFilter(qp) {
  const f = {};
  const q = String(qp.q || "").trim();
  if (q) f.$or = [{ regId: rx(q) }, { fullName: rx(q) }, { email: rx(q) }, { mobile: rx(q) }, { workshop: rx(q) }, { profession: rx(q) }];
  if (qp.status) f.paymentStatus = String(qp.status);
  if (qp.workshop) f.workshop = String(qp.workshop);
  if (qp.profession) f.profession = String(qp.profession);
  if (qp.experience) f.experience = String(qp.experience);
  if (qp.method) f.paymentMethod = String(qp.method);
  if (qp.attended === "true") f.attended = true;
  if (qp.dateFrom || qp.dateTo) {
    f.createdAt = {};
    if (qp.dateFrom) f.createdAt.$gte = new Date(qp.dateFrom);
    if (qp.dateTo) { const d = new Date(qp.dateTo); d.setHours(23, 59, 59, 999); f.createdAt.$lte = d; }
  }
  return f;
}

async function list(req, res) {
  try {
    const filter = buildFilter(req.query);
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "25", 10), 1), 200);
    const sortField = SORTABLE.has(req.query.sort) ? req.query.sort : "createdAt";
    const dir = req.query.dir === "asc" ? 1 : -1;

    const [items, total] = await Promise.all([
      Registration.find(filter).sort({ [sortField]: dir }).skip((page - 1) * limit).limit(limit)
        .select("regId fullName mobile email profession experience city mode workshop paymentStatus amount paymentMethod attended certificateIssued waitlisted createdAt").lean(),
      Registration.countDocuments(filter),
    ]);
    return res.json({ status: "success", items, page, limit, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("[registrations/list]", err.message);
    return res.status(500).json({ status: "error", message: "Could not list registrations" });
  }
}

async function stats(req, res) {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const [byStatus, total, todayCount, revenueAgg, attendedCount] = await Promise.all([
      Registration.aggregate([{ $group: { _id: "$paymentStatus", n: { $sum: 1 } } }]),
      Registration.countDocuments({}),
      Registration.countDocuments({ createdAt: { $gte: today } }),
      Registration.aggregate([{ $match: { paymentStatus: "Paid" } }, { $group: { _id: null, sum: { $sum: "$amount" } } }]),
      Registration.countDocuments({ attended: true }),
    ]);
    const s = Object.fromEntries(byStatus.map((x) => [x._id, x.n]));
    const paid = s.Paid || 0;
    return res.json({
      status: "success",
      cards: {
        total, today: todayCount,
        pending: s.Pending || 0, paid, failed: s.Failed || 0,
        cancelled: s.Cancelled || 0, refunded: s.Refunded || 0,
        attended: attendedCount,
        revenue: (revenueAgg[0] && revenueAgg[0].sum) || 0,
        conversion: total ? Math.round((paid / total) * 1000) / 10 : 0, // %
      },
    });
  } catch (err) {
    console.error("[registrations/stats]", err.message);
    return res.status(500).json({ status: "error", message: "Could not load stats" });
  }
}

async function facets(req, res) {
  try {
    const [workshops, professions, experiences, methods] = await Promise.all([
      Registration.distinct("workshop"), Registration.distinct("profession"),
      Registration.distinct("experience"), Registration.distinct("paymentMethod"),
    ]);
    return res.json({
      status: "success", statuses: STATUSES,
      workshops: workshops.filter(Boolean).sort(),
      professions: professions.filter(Boolean).sort(),
      experiences: experiences.filter(Boolean).sort(),
      methods: methods.filter(Boolean).sort(),
    });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Could not load filters" });
  }
}

async function getOne(req, res) {
  try {
    const r = await Registration.findById(req.params.id).lean();
    if (!r) return res.status(404).json({ status: "error", message: "Not found" });
    return res.json({ status: "success", registration: r });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Could not load registration" });
  }
}

const FLAGS = ["attended", "certificateIssued", "waitlisted"];
function applyPatch(reg, patch, by) {
  if (patch.paymentStatus && STATUSES.includes(patch.paymentStatus) && patch.paymentStatus !== reg.paymentStatus) {
    reg.activity.push({ type: "status", detail: `Payment: ${reg.paymentStatus} → ${patch.paymentStatus}`, by });
    reg.paymentStatus = patch.paymentStatus;
  }
  for (const flag of FLAGS) {
    if (typeof patch[flag] === "boolean" && patch[flag] !== reg[flag]) {
      reg.activity.push({ type: "flag", detail: `${flag} → ${patch[flag]}`, by });
      reg[flag] = patch[flag];
    }
  }
}

async function patch(req, res) {
  try {
    const reg = await Registration.findById(req.params.id);
    if (!reg) return res.status(404).json({ status: "error", message: "Not found" });
    applyPatch(reg, req.body || {}, (req.user && req.user.email) || "admin");
    await reg.save();
    return res.json({ status: "success", registration: reg });
  } catch (err) {
    console.error("[registrations/patch]", err.message);
    return res.status(500).json({ status: "error", message: "Could not update registration" });
  }
}

async function addNote(req, res) {
  try {
    const text = String((req.body || {}).text || "").trim();
    if (!text) return res.status(400).json({ status: "error", message: "Note text is required" });
    const by = (req.user && req.user.email) || "admin";
    const reg = await Registration.findById(req.params.id);
    if (!reg) return res.status(404).json({ status: "error", message: "Not found" });
    reg.notes.push({ text, by });
    reg.activity.push({ type: "note", detail: "Added a note", by });
    await reg.save();
    return res.json({ status: "success", registration: reg });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Could not add note" });
  }
}

async function remove(req, res) {
  try {
    const r = await Registration.findByIdAndDelete(req.params.id);
    if (!r) return res.status(404).json({ status: "error", message: "Not found" });
    return res.json({ status: "success" });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Could not delete" });
  }
}

async function bulk(req, res) {
  try {
    const { ids, action, patch: p } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ status: "error", message: "No rows selected" });
    if (action === "delete") {
      if (req.user && req.user.can && !req.user.can("registrations", "delete")) return res.status(403).json({ status: "error", message: "You don't have permission to delete registrations" });
      const r = await Registration.deleteMany({ _id: { $in: ids } });
      return res.json({ status: "success", deleted: r.deletedCount });
    }
    if (action === "status") {
      if (!p || typeof p !== "object") return res.status(400).json({ status: "error", message: "Missing patch" });
      const by = (req.user && req.user.email) || "admin";
      const docs = await Registration.find({ _id: { $in: ids } });
      for (const reg of docs) { applyPatch(reg, p, by); await reg.save(); }
      return res.json({ status: "success", updated: docs.length });
    }
    return res.status(400).json({ status: "error", message: "Unknown action" });
  } catch (err) {
    console.error("[registrations/bulk]", err.message);
    return res.status(500).json({ status: "error", message: "Bulk action failed" });
  }
}

/** GET /api/registrations/export?format=csv|xlsx — filtered OR selected (ids). */
async function exportRows(req, res) {
  try {
    const format = req.query.format === "xlsx" ? "xlsx" : "csv";
    const filter = req.query.ids ? { _id: { $in: String(req.query.ids).split(",").filter(Boolean) } } : buildFilter(req.query);
    const rows = await Registration.find(filter).sort({ createdAt: -1 }).limit(50000).lean();
    const stamp = new Date().toISOString().slice(0, 10);
    await audit.record(req, "registration.export", { resource: "registrations", newValue: { format, count: rows.length } });

    if (format === "xlsx") {
      const buf = await buildXlsx(rows);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="registrations-${stamp}.xlsx"`);
      return res.send(Buffer.from(buf));
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="registrations-${stamp}.csv"`);
    return res.send(buildCsv(rows));
  } catch (err) {
    console.error("[registrations/export]", err.message);
    return res.status(500).json({ status: "error", message: "Export failed" });
  }
}

module.exports = { list, stats, facets, getOne, patch, addNote, remove, bulk, exportRows };
