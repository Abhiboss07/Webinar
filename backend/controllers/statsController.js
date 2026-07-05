"use strict";
/**
 * Dashboard analytics — aggregated from the Registration collection (mirrored
 * from the live sign-up flow) plus the active workshop from SiteConfig.
 * Admin-only (mounted behind requireAuth).
 */
const Registration = require("../models/Registration");
const SiteConfig = require("../models/SiteConfig");

// Reporting timezone. The audience/workshop is India-based, so days are bucketed
// in IST (fixed +05:30, no DST) rather than the server's UTC. Both the day
// windows AND the Mongo $dateToString grouping use this, so buckets always align.
// (Phase 2.8 can surface this as an editable Setting.)
const TZ_OFFSET_MIN = 330;
const TZ_STRING = "+05:30";

/** IST day N days ago: its wall-clock date key AND the real UTC instant it starts. */
function istDay(offsetDays = 0) {
  const ist = new Date(Date.now() + TZ_OFFSET_MIN * 60000);
  ist.setUTCHours(0, 0, 0, 0);
  ist.setUTCDate(ist.getUTCDate() - offsetDays);
  return { key: ist.toISOString().slice(0, 10), startUTC: new Date(ist.getTime() - TZ_OFFSET_MIN * 60000) };
}

async function dashboard(req, res) {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days || "14", 10), 7), 90);
    const todayStart = istDay(0).startUTC;
    const rangeStart = istDay(days - 1).startUTC;

    const [
      total, today, pending, paid, failed,
      revenueAgg, byDayAgg, bySourceAgg, recent, cfg,
    ] = await Promise.all([
      Registration.countDocuments({}),
      Registration.countDocuments({ createdAt: { $gte: todayStart } }),
      Registration.countDocuments({ paymentStatus: "Pending" }),
      Registration.countDocuments({ paymentStatus: "Paid" }),
      Registration.countDocuments({ paymentStatus: "Failed" }),
      Registration.aggregate([
        { $match: { paymentStatus: "Paid" } },
        { $group: { _id: null, sum: { $sum: "$amount" } } },
      ]),
      Registration.aggregate([
        { $match: { createdAt: { $gte: rangeStart } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: TZ_STRING } },
            total: { $sum: 1 },
            paid: { $sum: { $cond: [{ $eq: ["$paymentStatus", "Paid"] }, 1, 0] } },
          },
        },
      ]),
      Registration.aggregate([
        { $group: { _id: { $ifNull: ["$sourceHost", ""] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      Registration.find({}, "fullName city profession paymentStatus amount createdAt")
        .sort({ createdAt: -1 }).limit(8).lean(),
      SiteConfig.getSingleton(),
    ]);

    // ---- time series: fill every day in the window (zeros included) ----
    const byDayMap = new Map(byDayAgg.map((r) => [r._id, r]));
    const series = [];
    for (let i = days - 1; i >= 0; i--) {
      const { key } = istDay(i);
      const hit = byDayMap.get(key);
      series.push({ date: key, total: hit ? hit.total : 0, paid: hit ? hit.paid : 0 });
    }

    // ---- source breakdown: top 5 + "Other" ----
    const sources = bySourceAgg.map((s) => ({ label: s._id || "Direct", count: s.count }));
    const topSources = sources.slice(0, 5);
    const otherCount = sources.slice(5).reduce((n, s) => n + s.count, 0);
    if (otherCount > 0) topSources.push({ label: "Other", count: otherCount });

    const w = (cfg.data && cfg.data.workshop) || {};

    return res.json({
      status: "success",
      cards: {
        total,
        today,
        pending,
        paid,
        failed,
        revenue: (revenueAgg[0] && revenueAgg[0].sum) || 0,
        currency: "INR",
      },
      workshop: { name: w.name || "", date: w.date || "", time: w.time || "", venue: w.venue || "", price: w.price || "" },
      charts: {
        registrationsOverTime: series,
        paymentStatus: [
          { label: "Paid", value: paid, role: "good" },
          { label: "Pending", value: pending, role: "warning" },
          { label: "Failed", value: failed, role: "critical" },
        ],
        sourceBreakdown: topSources,
      },
      recentActivity: recent.map((r) => ({
        name: r.fullName || "—",
        city: r.city || "",
        profession: r.profession || "",
        status: r.paymentStatus,
        amount: r.amount || 0,
        at: r.createdAt,
      })),
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[stats/dashboard] error:", err.message);
    return res.status(500).json({ status: "error", message: "Could not load dashboard stats" });
  }
}

module.exports = { dashboard };
