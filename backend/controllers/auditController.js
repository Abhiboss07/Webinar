"use strict";
const AuditLog = require("../models/AuditLog");
const { clean } = require("../utils/helpers");

async function list(req, res) {
  try {
    const filter = {};
    if (req.query.action) filter.action = clean(req.query.action);
    if (req.query.user) filter.userEmail = new RegExp(clean(req.query.user), "i");
    if (req.query.dateFrom || req.query.dateTo) {
      filter.at = {};
      if (req.query.dateFrom) filter.at.$gte = new Date(req.query.dateFrom);
      if (req.query.dateTo) { const d = new Date(req.query.dateTo); d.setHours(23, 59, 59, 999); filter.at.$lte = d; }
    }
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "50", 10), 1), 200);
    const [items, total, actions] = await Promise.all([
      AuditLog.find(filter).sort({ at: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      AuditLog.countDocuments(filter),
      AuditLog.distinct("action"),
    ]);
    return res.json({ status: "success", items, page, limit, total, pages: Math.ceil(total / limit), actions: actions.sort() });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Could not load audit log" });
  }
}

module.exports = { list };
