"use strict";
/** Business-intelligence aggregations across all modules. Read-only; RBAC
 *  `analytics`. Exports are permission-gated and audited. */
const Registration = require("../models/Registration");
const Certificate = require("../models/Certificate");
const Message = require("../models/Message");
const Workshop = require("../models/Workshop");
const audit = require("../services/audit");
const { buildCsv, buildXlsx } = require("../services/exportRegistrations");

const TZ = "+05:30", TZO = 330;
function istDay(off = 0) { const d = new Date(Date.now() + TZO * 60000); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - off); return { key: d.toISOString().slice(0, 10), startUTC: new Date(d.getTime() - TZO * 60000) }; }
const MAX_SPAN_DAYS = 366;
function range(q, def = 30) {
  const to = q.to ? new Date(q.to) : new Date();
  let from = q.from ? new Date(q.from) : new Date(Date.now() - def * 86400000);
  to.setHours(23, 59, 59, 999);
  // Clamp the span so daily series always cover the recent end (and stay bounded).
  const minFrom = new Date(to.getTime() - MAX_SPAN_DAYS * 86400000);
  if (from < minFrom) from = minFrom;
  return { from, to };
}
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0);
const dayGroup = (field) => ({ $dateToString: { format: "%Y-%m-%d", date: `$${field}`, timezone: TZ } });

function fillDays(agg, from, to) {
  const map = new Map(agg.map((r) => [r._id, r]));
  const out = []; const cur = new Date(from); cur.setHours(0, 0, 0, 0);
  while (cur <= to && out.length < 400) {
    const key = new Date(cur.getTime() + TZO * 60000).toISOString().slice(0, 10);
    const hit = map.get(key);
    out.push({ date: key, total: hit ? (hit.total || hit.sum || hit.count || 0) : 0 });
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

async function executive(req, res) {
  try {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const [total, paidAgg, checkedIn, certs, refunded, paidCount, activeWs, repeat, thisM, lastM] = await Promise.all([
      Registration.countDocuments({}),
      Registration.aggregate([{ $match: { paymentStatus: "Paid" } }, { $group: { _id: null, sum: { $sum: "$amount" }, n: { $sum: 1 } } }]),
      Registration.countDocuments({ checkedInAt: { $ne: null } }),
      Certificate.countDocuments({ status: "valid" }),
      Registration.countDocuments({ paymentStatus: "Refunded" }),
      Registration.countDocuments({ paymentStatus: "Paid" }),
      Workshop.countDocuments({ status: "published" }),
      Registration.aggregate([{ $match: { email: { $ne: "" } } }, { $group: { _id: "$email", n: { $sum: 1 } } }, { $match: { n: { $gt: 1 } } }, { $count: "c" }]),
      Registration.countDocuments({ createdAt: { $gte: thisMonth } }),
      Registration.countDocuments({ createdAt: { $gte: lastMonth, $lt: thisMonth } }),
    ]);
    const revenue = (paidAgg[0] && paidAgg[0].sum) || 0;
    return res.json({
      status: "success",
      cards: {
        totalRevenue: revenue, totalRegistrations: total, activeWorkshops: activeWs,
        attendanceRate: pct(checkedIn, total), certificatesIssued: certs,
        conversionRate: pct(paidCount, total), refundRate: pct(refunded, paidCount),
        avgTicket: paidCount ? Math.round(revenue / paidCount) : 0,
        repeatCustomers: (repeat[0] && repeat[0].c) || 0,
        monthlyGrowth: lastM ? Math.round(((thisM - lastM) / lastM) * 1000) / 10 : (thisM ? 100 : 0),
      },
    });
  } catch (err) { console.error("[analytics/executive]", err.message); return res.status(500).json({ status: "error", message: "Could not load analytics" }); }
}

async function revenue(req, res) {
  try {
    const { from, to } = range(req.query);
    const [byDay, byWorkshop, methods, refundByDay] = await Promise.all([
      Registration.aggregate([{ $match: { paymentStatus: "Paid", transactionTime: { $gte: from, $lte: to } } }, { $group: { _id: dayGroup("transactionTime"), sum: { $sum: "$amount" } } }]),
      Registration.aggregate([{ $match: { paymentStatus: "Paid" } }, { $group: { _id: "$workshop", sum: { $sum: "$amount" } } }, { $sort: { sum: -1 } }, { $limit: 8 }]),
      Registration.aggregate([{ $match: { paymentStatus: "Paid" } }, { $group: { _id: "$paymentMethod", n: { $sum: 1 }, sum: { $sum: "$amount" } } }, { $sort: { sum: -1 } }]),
      Registration.aggregate([{ $match: { paymentStatus: "Refunded", refundedAt: { $gte: from, $lte: to } } }, { $group: { _id: dayGroup("refundedAt"), sum: { $sum: "$refundAmount" } } }]),
    ]);
    const daily = fillDays(byDay, from, to);
    const avg = daily.length ? daily.reduce((s, d) => s + d.total, 0) / daily.length : 0;
    return res.json({
      status: "success",
      daily,
      byWorkshop: byWorkshop.map((w) => ({ label: w._id || "—", count: w.sum })),
      methodSplit: methods.map((m) => ({ label: m._id || "unknown", value: m.n, amount: m.sum })),
      refundTrend: fillDays(refundByDay, from, to),
      forecastNext7: Math.round(avg * 7),
    });
  } catch (err) { return res.status(500).json({ status: "error", message: "Could not load revenue analytics" }); }
}

async function registrations(req, res) {
  try {
    const { from, to } = range(req.query);
    const [byDay, prof, city, funnel, statuses] = await Promise.all([
      Registration.aggregate([{ $match: { createdAt: { $gte: from, $lte: to } } }, { $group: { _id: dayGroup("createdAt"), count: { $sum: 1 } } }]),
      Registration.aggregate([{ $group: { _id: "$profession", n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 8 }]),
      Registration.aggregate([{ $match: { city: { $ne: "" } } }, { $group: { _id: "$city", n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 8 }]),
      Promise.all([Registration.countDocuments({}), Registration.countDocuments({ paymentStatus: "Paid" }), Registration.countDocuments({ checkedInAt: { $ne: null } }), Certificate.countDocuments({ status: "valid" })]),
      Registration.aggregate([{ $group: { _id: "$paymentStatus", n: { $sum: 1 } } }]),
    ]);
    const sc = Object.fromEntries(statuses.map((s) => [s._id, s.n]));
    return res.json({
      status: "success",
      daily: fillDays(byDay, from, to),
      professions: prof.map((p) => ({ label: p._id || "—", count: p.n })),
      cities: city.map((c) => ({ label: c._id, count: c.n })),
      funnel: [{ label: "Registered", value: funnel[0] }, { label: "Paid", value: funnel[1] }, { label: "Attended", value: funnel[2] }, { label: "Certified", value: funnel[3] }],
      cancelled: sc.Cancelled || 0, refunded: sc.Refunded || 0,
      waitlisted: await Registration.countDocuments({ waitlisted: true }),
    });
  } catch (err) { return res.status(500).json({ status: "error", message: "Could not load registration analytics" }); }
}

async function attendance(req, res) {
  try {
    const [total, checkedIn, byHour, heat, byWorkshop] = await Promise.all([
      Registration.countDocuments({}),
      Registration.countDocuments({ checkedInAt: { $ne: null } }),
      Registration.aggregate([{ $match: { checkedInAt: { $ne: null } } }, { $group: { _id: { $hour: { date: "$checkedInAt", timezone: TZ } }, n: { $sum: 1 } } }]),
      Registration.aggregate([{ $match: { checkedInAt: { $ne: null } } }, { $group: { _id: { d: { $dayOfWeek: { date: "$checkedInAt", timezone: TZ } }, h: { $hour: { date: "$checkedInAt", timezone: TZ } } }, n: { $sum: 1 } } }]),
      Registration.aggregate([{ $group: { _id: "$workshop", registered: { $sum: 1 }, attended: { $sum: { $cond: [{ $ne: ["$checkedInAt", null] }, 1, 0] } } } }, { $sort: { registered: -1 } }, { $limit: 8 }]),
    ]);
    const hours = Array.from({ length: 24 }, (_, h) => ({ date: String(h), total: (byHour.find((x) => x._id === h) || {}).n || 0 }));
    return res.json({
      status: "success",
      attendanceRate: pct(checkedIn, total), noShows: total - checkedIn,
      checkinByHour: hours,
      heatmap: heat.map((x) => ({ day: x._id.d, hour: x._id.h, value: x.n })),
      byWorkshop: byWorkshop.map((w) => ({ label: w._id || "—", registered: w.registered, count: w.attended })),
    });
  } catch (err) { return res.status(500).json({ status: "error", message: "Could not load attendance analytics" }); }
}

async function certificates(req, res) {
  try {
    const [valid, revoked, byWorkshop, attended] = await Promise.all([
      Certificate.countDocuments({ status: "valid" }),
      Certificate.countDocuments({ status: "revoked" }),
      Certificate.aggregate([{ $group: { _id: "$workshop", n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 8 }]),
      Registration.countDocuments({ checkedInAt: { $ne: null } }),
    ]);
    return res.json({ status: "success", issued: valid, revoked, pending: Math.max(attended - valid, 0), byWorkshop: byWorkshop.map((w) => ({ label: w._id || "—", count: w.n })) });
  } catch (err) { return res.status(500).json({ status: "error", message: "Could not load certificate analytics" }); }
}

async function communication(req, res) {
  try {
    const [byStatus, byChannel, retries] = await Promise.all([
      Message.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
      Message.aggregate([{ $group: { _id: "$channel", n: { $sum: 1 } } }]),
      Message.aggregate([{ $group: { _id: null, retries: { $sum: "$retries" }, opens: { $sum: "$opens" }, clicks: { $sum: "$clicks" } } }]),
    ]);
    const s = Object.fromEntries(byStatus.map((x) => [x._id, x.n]));
    const sent = (s.sent || 0) + (s.delivered || 0), failed = s.failed || 0;
    return res.json({
      status: "success",
      byChannel: byChannel.map((c) => ({ label: c._id, count: c.n })),
      byStatus: byStatus.map((x) => ({ label: x._id, value: x.n })),
      deliveryRate: pct(sent, sent + failed), failureRate: pct(failed, sent + failed),
      retryCount: (retries[0] && retries[0].retries) || 0, opens: (retries[0] && retries[0].opens) || 0, clicks: (retries[0] && retries[0].clicks) || 0,
    });
  } catch (err) { return res.status(500).json({ status: "error", message: "Could not load communication analytics" }); }
}

async function workshops(req, res) {
  try {
    const [regAgg, certAgg] = await Promise.all([
      Registration.aggregate([{ $group: { _id: "$workshop", registrations: { $sum: 1 }, revenue: { $sum: { $cond: [{ $eq: ["$paymentStatus", "Paid"] }, "$amount", 0] } }, attended: { $sum: { $cond: [{ $ne: ["$checkedInAt", null] }, 1, 0] } } } }]),
      Certificate.aggregate([{ $match: { status: "valid" } }, { $group: { _id: "$workshop", certs: { $sum: 1 } } }]),
    ]);
    const cmap = Object.fromEntries(certAgg.map((c) => [c._id, c.certs]));
    const rows = regAgg.map((w) => ({ workshop: w._id || "—", registrations: w.registrations, revenue: w.revenue, attended: w.attended, certificates: cmap[w._id] || 0, completionRate: pct(cmap[w._id] || 0, w.attended) }));
    rows.sort((a, b) => b.revenue - a.revenue);
    return res.json({ status: "success", workshops: rows, top: rows.slice(0, 5), lowest: rows.slice().reverse().slice(0, 5) });
  } catch (err) { return res.status(500).json({ status: "error", message: "Could not load workshop analytics" }); }
}

/** Export a report as CSV/XLSX. report=revenue|registrations|workshops */
async function exportReport(req, res) {
  try {
    const report = String(req.query.report || "workshops");
    const format = req.query.format === "xlsx" ? "xlsx" : "csv";
    let rows = [], cols = [];
    if (report === "workshops") {
      const r = await Registration.aggregate([{ $group: { _id: "$workshop", registrations: { $sum: 1 }, revenue: { $sum: { $cond: [{ $eq: ["$paymentStatus", "Paid"] }, "$amount", 0] } }, attended: { $sum: { $cond: [{ $ne: ["$checkedInAt", null] }, 1, 0] } } } }, { $sort: { revenue: -1 } }]);
      rows = r.map((x) => ({ workshop: x._id || "—", registrations: x.registrations, revenue: x.revenue, attended: x.attended }));
      cols = [["workshop", "Workshop"], ["registrations", "Registrations"], ["revenue", "Revenue"], ["attended", "Attended"]].map(([k, h]) => ({ key: k, header: h, get: (r) => r[k] }));
    } else {
      const { from, to } = range(req.query);
      const field = report === "revenue" ? "transactionTime" : "createdAt";
      const match = report === "revenue" ? { paymentStatus: "Paid", transactionTime: { $gte: from, $lte: to } } : { createdAt: { $gte: from, $lte: to } };
      const r = await Registration.aggregate([{ $match: match }, { $group: { _id: dayGroup(field), value: report === "revenue" ? { $sum: "$amount" } : { $sum: 1 } } }, { $sort: { _id: 1 } }]);
      rows = r.map((x) => ({ date: x._id, value: x.value }));
      cols = [["date", "Date"], ["value", report === "revenue" ? "Revenue" : "Registrations"]].map(([k, h]) => ({ key: k, header: h, get: (r) => r[k] }));
    }
    await audit.record(req, "analytics.export", { resource: "analytics", newValue: { report, format, rows: rows.length } });
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "xlsx") {
      const buf = await buildXlsx(rows, cols, report);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${report}-${stamp}.xlsx"`);
      return res.send(Buffer.from(buf));
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${report}-${stamp}.csv"`);
    return res.send(buildCsv(rows, cols));
  } catch (err) { console.error("[analytics/export]", err.message); return res.status(500).json({ status: "error", message: "Export failed" }); }
}

module.exports = { executive, revenue, registrations, attendance, certificates, communication, workshops, exportReport };
