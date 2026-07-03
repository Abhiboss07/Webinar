"use strict";
/**
 * Payment Manager — a payment-focused admin view over the Registration
 * collection (which already carries orderId/paymentId/amount/method/status).
 * Read + admin actions only; the public verifyPayment/Razorpay flow is untouched.
 * Responses NEVER include any secret (keys, webhook secret, signatures, JWT).
 */
const Registration = require("../models/Registration");
const SiteConfig = require("../models/SiteConfig");
const razorpayService = require("../services/razorpayService");
const audit = require("../services/audit");
const { buildCsv, buildXlsx, PAYMENT_COLUMNS } = require("../services/exportRegistrations");
const { buildPdf } = require("../services/invoice");

const rx = (s) => new RegExp(String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
const TZ = 330;
function istDay(off = 0) {
  const d = new Date(Date.now() + TZ * 60000); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - off);
  return { key: d.toISOString().slice(0, 10), startUTC: new Date(d.getTime() - TZ * 60000) };
}
const SELECT = "regId fullName email mobile workshop orderId paymentId paymentMethod amount currency paymentStatus createdAt transactionTime refundId refundAmount refundedAt";

function buildFilter(qp) {
  const f = {};
  const q = String(qp.q || "").trim();
  if (q) f.$or = [{ paymentId: rx(q) }, { orderId: rx(q) }, { regId: rx(q) }, { fullName: rx(q) }, { email: rx(q) }];
  if (qp.status) f.paymentStatus = String(qp.status);
  if (qp.workshop) f.workshop = String(qp.workshop);
  if (qp.method) f.paymentMethod = String(qp.method);
  if (qp.amountMin || qp.amountMax) {
    f.amount = {};
    if (qp.amountMin) f.amount.$gte = Number(qp.amountMin);
    if (qp.amountMax) f.amount.$lte = Number(qp.amountMax);
  }
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
    const dir = req.query.dir === "asc" ? 1 : -1;
    const sortField = ["createdAt", "amount", "transactionTime"].includes(req.query.sort) ? req.query.sort : "createdAt";
    const [items, total] = await Promise.all([
      Registration.find(filter).sort({ [sortField]: dir }).skip((page - 1) * limit).limit(limit).select(SELECT).lean(),
      Registration.countDocuments(filter),
    ]);
    return res.json({ status: "success", items: items.map((r) => ({ ...r, gateway: "Razorpay" })), page, limit, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error("[payments/list]", err.message);
    return res.status(500).json({ status: "error", message: "Could not list payments" });
  }
}

async function stats(req, res) {
  try {
    const today = istDay(0).startUTC;
    const [byStatus, total, revAgg, todayAgg] = await Promise.all([
      Registration.aggregate([{ $group: { _id: "$paymentStatus", n: { $sum: 1 } } }]),
      Registration.countDocuments({}),
      Registration.aggregate([{ $match: { paymentStatus: "Paid" } }, { $group: { _id: null, sum: { $sum: "$amount" }, n: { $sum: 1 } } }]),
      Registration.aggregate([{ $match: { paymentStatus: "Paid", transactionTime: { $gte: today } } }, { $group: { _id: null, sum: { $sum: "$amount" } } }]),
    ]);
    const s = Object.fromEntries(byStatus.map((x) => [x._id, x.n]));
    const paid = (revAgg[0] && revAgg[0].n) || 0;
    const revenue = (revAgg[0] && revAgg[0].sum) || 0;
    return res.json({
      status: "success",
      cards: {
        revenue, todayRevenue: (todayAgg[0] && todayAgg[0].sum) || 0,
        pending: s.Pending || 0, successful: paid, failed: s.Failed || 0,
        refunded: s.Refunded || 0, cancelled: s.Cancelled || 0,
        avgTicket: paid ? Math.round(revenue / paid) : 0,
        conversion: total ? Math.round((paid / total) * 1000) / 10 : 0,
      },
    });
  } catch (err) {
    console.error("[payments/stats]", err.message);
    return res.status(500).json({ status: "error", message: "Could not load payment stats" });
  }
}

async function analytics(req, res) {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days || "14", 10), 7), 90);
    const rangeStart = istDay(days - 1).startUTC;
    const [byDay, byWorkshop, counts] = await Promise.all([
      Registration.aggregate([
        { $match: { paymentStatus: "Paid", transactionTime: { $gte: rangeStart } } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$transactionTime", timezone: "+05:30" } }, sum: { $sum: "$amount" } } },
      ]),
      Registration.aggregate([
        { $match: { paymentStatus: "Paid" } },
        { $group: { _id: "$workshop", sum: { $sum: "$amount" } } },
        { $sort: { sum: -1 } }, { $limit: 6 },
      ]),
      Registration.aggregate([{ $group: { _id: "$paymentStatus", n: { $sum: 1 } } }]),
    ]);
    const map = new Map(byDay.map((r) => [r._id, r.sum]));
    const revenueByDay = [];
    for (let i = days - 1; i >= 0; i--) { const { key } = istDay(i); revenueByDay.push({ date: key, total: map.get(key) || 0 }); }
    const s = Object.fromEntries(counts.map((x) => [x._id, x.n]));
    const paid = s.Paid || 0, failed = s.Failed || 0, refunded = s.Refunded || 0;
    return res.json({
      status: "success",
      revenueByDay,
      revenueByWorkshop: byWorkshop.map((w) => ({ label: w._id || "—", count: w.sum })),
      successRate: paid + failed ? Math.round((paid / (paid + failed)) * 1000) / 10 : 0,
      refundRate: paid ? Math.round((refunded / paid) * 1000) / 10 : 0,
    });
  } catch (err) {
    console.error("[payments/analytics]", err.message);
    return res.status(500).json({ status: "error", message: "Could not load analytics" });
  }
}

async function getOne(req, res) {
  try {
    const r = await Registration.findById(req.params.id).lean();
    if (!r) return res.status(404).json({ status: "error", message: "Not found" });
    return res.json({ status: "success", payment: { ...r, gateway: "Razorpay", verified: !!r.paymentId && r.paymentStatus === "Paid" } });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Could not load payment" });
  }
}

/** Re-check a payment against the gateway and reconcile its status. */
async function retryVerify(req, res) {
  try {
    const reg = await Registration.findById(req.params.id);
    if (!reg) return res.status(404).json({ status: "error", message: "Not found" });
    if (!reg.paymentId) return res.status(400).json({ status: "error", message: "No payment id to verify" });
    const info = await razorpayService.fetchPayment(reg.paymentId);
    if (!info) return res.status(502).json({ status: "error", message: "Could not reach the gateway or payment not found" });
    const by = (req.user && req.user.email) || "admin";
    if (info.status === "captured") {
      if (reg.paymentStatus !== "Paid") { reg.activity.push({ type: "verify", detail: `Re-verified → captured (was ${reg.paymentStatus})`, by }); reg.paymentStatus = "Paid"; }
      if (info.amount != null) reg.amount = info.amount / 100;
      if (!reg.transactionTime) reg.transactionTime = new Date();
    } else if (info.status === "failed") {
      reg.activity.push({ type: "verify", detail: "Re-verified → failed", by }); reg.paymentStatus = "Failed";
    } else {
      reg.activity.push({ type: "verify", detail: `Gateway status: ${info.status}`, by });
    }
    await reg.save();
    return res.json({ status: "success", gatewayStatus: info.status, payment: { ...reg.toObject(), gateway: "Razorpay" } });
  } catch (err) {
    console.error("[payments/retryVerify]", err.message);
    return res.status(500).json({ status: "error", message: "Verification failed" });
  }
}

/** Manual status override (Paid / Failed) — logged. */
async function markStatus(req, res) {
  try {
    const next = String((req.body || {}).status || "");
    if (!["Paid", "Failed"].includes(next)) return res.status(400).json({ status: "error", message: "Status must be Paid or Failed" });
    const reg = await Registration.findById(req.params.id);
    if (!reg) return res.status(404).json({ status: "error", message: "Not found" });
    const by = (req.user && req.user.email) || "admin";
    if (reg.paymentStatus !== next) {
      reg.activity.push({ type: "status", detail: `Payment manually set: ${reg.paymentStatus} → ${next}`, by });
      reg.paymentStatus = next;
      if (next === "Paid" && !reg.transactionTime) reg.transactionTime = new Date();
    }
    await reg.save();
    return res.json({ status: "success", payment: { ...reg.toObject(), gateway: "Razorpay" } });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Could not update payment" });
  }
}

/**
 * Refund. Default attempts a real gateway refund; pass { gateway:false } to just
 * record a manual/out-of-band refund. Only allowed on a Paid payment.
 */
async function refund(req, res) {
  try {
    const reg = await Registration.findById(req.params.id);
    if (!reg) return res.status(404).json({ status: "error", message: "Not found" });
    if (reg.paymentStatus !== "Paid") return res.status(400).json({ status: "error", message: "Only a Paid payment can be refunded" });
    const by = (req.user && req.user.email) || "admin";
    const useGateway = (req.body || {}).gateway !== false;
    const amount = Number((req.body || {}).amount) || reg.amount;

    if (useGateway) {
      if (!reg.paymentId) return res.status(400).json({ status: "error", message: "No gateway payment id — use a manual refund" });
      let r;
      try { r = await razorpayService.refundPayment(reg.paymentId, Math.round(amount * 100)); }
      catch (e) { return res.status(502).json({ status: "error", message: `Gateway refund failed: ${e.error?.description || e.message}` }); }
      reg.refundId = r.id || "";
    } else {
      reg.refundId = reg.refundId || "manual";
    }
    reg.refundAmount = amount;
    reg.refundedAt = new Date();
    reg.paymentStatus = "Refunded";
    reg.activity.push({ type: "refund", detail: `Refunded ${amount} ${reg.currency}${useGateway ? "" : " (manual)"}`, by });
    await reg.save();
    await audit.record(req, "payment.refund", { resource: "payments", targetId: reg._id, newValue: { amount, gateway: useGateway, refundId: reg.refundId } });
    return res.json({ status: "success", payment: { ...reg.toObject(), gateway: "Razorpay" } });
  } catch (err) {
    console.error("[payments/refund]", err.message);
    return res.status(500).json({ status: "error", message: "Refund failed" });
  }
}

async function document(req, res, kind) {
  try {
    const reg = await Registration.findById(req.params.id).lean();
    if (!reg) return res.status(404).json({ status: "error", message: "Not found" });
    const cfg = (await SiteConfig.getSingleton()).data || {};
    const contact = (cfg.footer && cfg.footer.contact) || {};
    const brand = {
      name: (cfg.brand && cfg.brand.name) || "Youngness Institute",
      email: contact.email, phone: contact.phone,
      address: Array.isArray(contact.addressLines) ? contact.addressLines.join(", ") : "",
    };
    const buf = await buildPdf(reg, kind, brand);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${kind.toLowerCase()}-${reg.regId || reg._id}.pdf"`);
    return res.send(buf);
  } catch (err) {
    console.error("[payments/document]", err.message);
    return res.status(500).json({ status: "error", message: "Could not generate document" });
  }
}
const receipt = (req, res) => document(req, res, "Receipt");
const invoice = (req, res) => document(req, res, "Invoice");

async function exportRows(req, res) {
  try {
    const format = req.query.format === "xlsx" ? "xlsx" : "csv";
    const filter = req.query.ids ? { _id: { $in: String(req.query.ids).split(",").filter(Boolean) } } : buildFilter(req.query);
    const rows = await Registration.find(filter).sort({ createdAt: -1 }).limit(50000).lean();
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "xlsx") {
      const buf = await buildXlsx(rows, PAYMENT_COLUMNS, "Payments");
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="payments-${stamp}.xlsx"`);
      return res.send(Buffer.from(buf));
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="payments-${stamp}.csv"`);
    return res.send(buildCsv(rows, PAYMENT_COLUMNS));
  } catch (err) {
    console.error("[payments/export]", err.message);
    return res.status(500).json({ status: "error", message: "Export failed" });
  }
}

module.exports = { list, stats, analytics, getOne, retryVerify, markStatus, refund, receipt, invoice, exportRows };
