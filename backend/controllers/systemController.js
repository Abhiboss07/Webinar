"use strict";
const os = require("os");
const fs = require("fs");
const path = require("path");
const pkg = require("../package.json");
const config = require("../config");
const { mongoose } = require("../db/connect");
const provider = require("../services/settingsProvider");
const audit = require("../services/audit");
const backupSvc = require("../services/backup");
const Backup = require("../models/Backup");
const SystemLog = require("../models/SystemLog");
const AuditLog = require("../models/AuditLog");
const Message = require("../models/Message");
const Media = require("../models/Media");
const User = require("../models/User");
const Session = require("../models/Session");
const CommState = require("../models/CommState");
const Certificate = require("../models/Certificate");

const START = Date.now();

function dirSize(dir) {
  let total = 0, files = 0;
  try {
    for (const name of fs.readdirSync(dir)) {
      const p = path.join(dir, name); const st = fs.statSync(p);
      if (st.isDirectory()) { const r = dirSize(p); total += r.total; files += r.files; }
      else { total += st.size; files += 1; }
    }
  } catch (_) { /* dir may not exist */ }
  return { total, files };
}

async function dbPing() {
  const t0 = Date.now();
  try { await mongoose.connection.db.command({ ping: 1 }); return { ok: true, ms: Date.now() - t0 }; }
  catch (_) { return { ok: false, ms: Date.now() - t0 }; }
}

async function overview(req, res) {
  try {
    const ping = await dbPing();
    const uploads = dirSize(path.resolve(process.cwd(), config.storage.uploadDir));
    const [activeUsers, activeSessions] = await Promise.all([
      User.countDocuments({ active: true }),
      Session.countDocuments({ revoked: false, expiresAt: { $gt: new Date() } }),
    ]);
    let mongoVersion = "unknown";
    try { mongoVersion = (await mongoose.connection.db.admin().serverInfo()).version; } catch (_) { /* */ }
    const mem = process.memoryUsage();
    return res.json({
      status: "success",
      server: { ok: true, uptimeSec: Math.round((Date.now() - START) / 1000), env: config.env },
      api: { ok: true },
      database: { ok: ping.ok, responseMs: ping.ms, version: mongoVersion, state: mongoose.connection.readyState },
      storage: { uploadBytes: uploads.total, uploadFiles: uploads.files, provider: config.storage.provider },
      memory: { rssMB: Math.round(mem.rss / 1048576), heapMB: Math.round(mem.heapUsed / 1048576), totalMB: Math.round(os.totalmem() / 1048576), freeMB: Math.round(os.freemem() / 1048576) },
      cpu: { cores: os.cpus().length, load1: Math.round(os.loadavg()[0] * 100) / 100 },
      node: process.version,
      activeUsers, activeSessions,
    });
  } catch (err) { return res.status(500).json({ status: "error", message: "Could not load overview" }); }
}

async function health(req, res) {
  const services = [];
  const ping = await dbPing();
  services.push({ name: "Database", ok: ping.ok, ms: ping.ms, detail: ping.ok ? "connected" : "unreachable" });
  try { const r = await provider.razorpay(); services.push({ name: "Razorpay", ok: !!(r.keyId && r.keySecret), detail: r.keyId ? `configured (${r.mode})` : "not configured" }); } catch (_) { services.push({ name: "Razorpay", ok: false, detail: "error" }); }
  try { const c = await provider.cloudinary(); services.push({ name: "Cloudinary", ok: !!c.cloudName, detail: c.cloudName ? "configured" : "local storage" }); } catch (_) { services.push({ name: "Cloudinary", ok: false }); }
  try { const s = await provider.sheets(); services.push({ name: "Google Sheets", ok: !!s.endpoint, detail: s.endpoint ? "endpoint set" : "not configured" }); } catch (_) { services.push({ name: "Google Sheets", ok: false }); }
  try { const m = await provider.smtp(); services.push({ name: "SMTP", ok: !!m.host, detail: m.host || "not configured" }); } catch (_) { services.push({ name: "SMTP", ok: false }); }
  return res.json({ status: "success", checkedAt: new Date().toISOString(), healthy: services.every((s) => s.ok), services });
}

async function storage(req, res) {
  try {
    const [agg, byType, largest, dupes] = await Promise.all([
      Media.aggregate([{ $group: { _id: null, count: { $sum: 1 }, bytes: { $sum: "$bytes" } } }]),
      Media.aggregate([{ $group: { _id: "$resourceType", count: { $sum: 1 }, bytes: { $sum: "$bytes" } } }]),
      Media.find({}).sort({ bytes: -1 }).limit(10).select("originalFilename bytes resourceType secureUrl").lean(),
      Media.aggregate([{ $group: { _id: "$checksum", n: { $sum: 1 } } }, { $match: { n: { $gt: 1 }, _id: { $ne: "" } } }, { $count: "groups" }]),
    ]);
    const uploads = dirSize(path.resolve(process.cwd(), config.storage.uploadDir));
    return res.json({
      status: "success",
      total: { count: (agg[0] && agg[0].count) || 0, bytes: (agg[0] && agg[0].bytes) || 0 },
      byType: byType.map((t) => ({ type: t._id, count: t.count, bytes: t.bytes })),
      largest, duplicateGroups: (dupes[0] && dupes[0].groups) || 0,
      localDisk: uploads, provider: config.storage.provider,
    });
  } catch (err) { return res.status(500).json({ status: "error", message: "Could not load storage" }); }
}

async function queue(req, res) {
  try {
    const [byStatus, byChannel, failed, paused] = await Promise.all([
      Message.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
      Message.aggregate([{ $group: { _id: "$channel", n: { $sum: 1 } } }]),
      Message.find({ status: "failed" }).sort({ updatedAt: -1 }).limit(20).select("channel to templateKey error retries updatedAt").lean(),
      CommState.getSingleton(),
    ]);
    const s = Object.fromEntries(byStatus.map((x) => [x._id, x.n]));
    return res.json({
      status: "success",
      paused: paused.paused,
      counts: { queued: s.queued || 0, sending: s.sending || 0, sent: s.sent || 0, failed: s.failed || 0, cancelled: s.cancelled || 0 },
      byChannel: byChannel.map((c) => ({ channel: c._id, count: c.n })),
      failedJobs: failed,
      healthy: (s.failed || 0) < 25 && !paused.paused,
    });
  } catch (err) { return res.status(500).json({ status: "error", message: "Could not load queue" }); }
}

const LOG_SOURCES = {
  auth: { model: AuditLog, filter: { action: /^(login|logout|password|session)/ }, dateField: "at", map: (x) => ({ at: x.at, level: /failed|locked/.test(x.action) ? "warn" : "info", category: "auth", message: `${x.action} — ${x.userEmail || ""} (${x.ip || ""})` }) },
  payment: { model: AuditLog, filter: { action: /^payment/ }, dateField: "at", map: (x) => ({ at: x.at, level: "info", category: "payment", message: `${x.action} — ${x.userEmail || ""}` }) },
  email: { model: Message, filter: { channel: "email" }, dateField: "createdAt", map: (x) => ({ at: x.createdAt, level: x.status === "failed" ? "error" : "info", category: "email", message: `${x.status} → ${x.to} (${x.templateKey || x.trigger})${x.error ? " · " + x.error : ""}` }) },
  whatsapp: { model: Message, filter: { channel: "whatsapp" }, dateField: "createdAt", map: (x) => ({ at: x.createdAt, level: x.status === "failed" ? "error" : "info", category: "whatsapp", message: `${x.status} → ${x.to}` }) },
  error: { model: SystemLog, filter: { level: "error" }, dateField: "at", map: (x) => ({ at: x.at, level: "error", category: x.category, message: x.message }) },
  app: { model: SystemLog, filter: {}, dateField: "at", map: (x) => ({ at: x.at, level: x.level, category: x.category, message: x.message }) },
};

async function logs(req, res) {
  try {
    const cat = LOG_SOURCES[req.query.category] ? req.query.category : "app";
    const src = LOG_SOURCES[cat];
    const filter = { ...src.filter };
    if (req.query.q) filter[cat === "email" || cat === "whatsapp" ? "to" : cat === "app" || cat === "error" ? "message" : "userEmail"] = new RegExp(String(req.query.q), "i");
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "50", 10), 1), 200);
    const [rows, total] = await Promise.all([
      src.model.find(filter).sort({ [src.dateField]: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      src.model.countDocuments(filter),
    ]);
    return res.json({ status: "success", category: cat, items: rows.map(src.map), page, limit, total, pages: Math.ceil(total / limit), categories: Object.keys(LOG_SOURCES) });
  } catch (err) { console.error("[system/logs]", err.message); return res.status(500).json({ status: "error", message: "Could not load logs" }); }
}

async function environment(req, res) {
  let mongoVersion = "unknown";
  try { mongoVersion = (await mongoose.connection.db.admin().serverInfo()).version; } catch (_) { /* */ }
  const required = ["MONGODB_URI", "JWT_SECRET", "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "GOOGLE_SHEET_ENDPOINT"];
  const missing = required.filter((k) => !process.env[k]);
  return res.json({
    status: "success",
    build: { version: pkg.version, node: process.version, mongo: mongoVersion, env: config.env, startedAt: new Date(START).toISOString(), uptimeSec: Math.round((Date.now() - START) / 1000) },
    validation: { configured: config.isConfigured(), missing },
  });
}

async function security(req, res) {
  try {
    const dayAgo = new Date(Date.now() - 86400000);
    const [failedLogins, recentFails, lockedUsers, sessions, sec] = await Promise.all([
      AuditLog.countDocuments({ action: "login.failed", at: { $gte: dayAgo } }),
      AuditLog.find({ action: /login\.(failed|locked)/ }).sort({ at: -1 }).limit(15).select("userEmail ip at action").lean(),
      User.find({ lockUntil: { $gt: new Date() } }).select("email lockUntil").lean(),
      Session.countDocuments({ revoked: false, expiresAt: { $gt: new Date() } }),
      provider.security(),
    ]);
    return res.json({
      status: "success",
      failedLogins24h: failedLogins, recentFailures: recentFails,
      lockedAccounts: lockedUsers.map((u) => ({ email: u.email, until: u.lockUntil })),
      activeSessions: sessions,
      passwordPolicy: { minLength: sec.passwordMinLength, maxLoginAttempts: sec.maxLoginAttempts, lockMinutes: sec.lockMinutes, twoFactor: sec.twoFactor },
    });
  } catch (err) { return res.status(500).json({ status: "error", message: "Could not load security" }); }
}

async function notifications(req, res) {
  try {
    const alerts = [];
    const [failedMsgs, failedBackups, sec] = await Promise.all([
      Message.countDocuments({ status: "failed" }),
      Backup.countDocuments({ verified: false }),
      provider.security(),
    ]);
    const uploads = dirSize(path.resolve(process.cwd(), config.storage.uploadDir));
    if (failedMsgs > 10) alerts.push({ level: "warn", title: "Queue failures", detail: `${failedMsgs} messages failed` });
    if (failedBackups > 0) alerts.push({ level: "error", title: "Unverified backups", detail: `${failedBackups} backup(s) failed verification` });
    if (uploads.total > 400 * 1048576) alerts.push({ level: "warn", title: "Low storage headroom", detail: `${Math.round(uploads.total / 1048576)}MB of local uploads` });
    if (sec.maintenance && sec.maintenance.enabled) alerts.push({ level: "info", title: "Maintenance mode ON", detail: sec.maintenance.message });
    const dbp = await dbPing(); if (!dbp.ok) alerts.push({ level: "error", title: "Database unreachable", detail: "ping failed" });
    return res.json({ status: "success", alerts });
  } catch (err) { return res.status(500).json({ status: "error", message: "Could not load notifications" }); }
}

/* ---- maintenance ---- */
async function getMaintenance(req, res) { const s = await provider.security(); return res.json({ status: "success", maintenance: s.maintenance }); }
async function setMaintenance(req, res) {
  try {
    const Settings = require("../models/Settings");
    const doc = await Settings.getSingleton();
    const data = doc.data || {}; data.security = data.security || {};
    data.security.maintenance = { enabled: !!(req.body || {}).enabled, message: String((req.body || {}).message || (data.security.maintenance && data.security.maintenance.message) || "We'll be back shortly.") };
    doc.data = data; doc.markModified("data"); await doc.save(); provider.invalidate();
    await audit.record(req, "system.maintenance", { resource: "system", newValue: data.security.maintenance });
    return res.json({ status: "success", maintenance: data.security.maintenance });
  } catch (err) { return res.status(500).json({ status: "error", message: "Could not update maintenance" }); }
}

/* ---- backups ---- */
async function createBackup(req, res) {
  try {
    const includeData = String((req.body || {}).includeData) === "true" || (req.body || {}).includeData === true;
    const b = await backupSvc.createBackup({ includeData });
    const doc = await Backup.create({ kind: "manual", collections: b.collections, includeData, size: b.size, checksum: b.checksum, verified: true, data: b.dataString, by: (req.user && req.user.email) || "" });
    await audit.record(req, "system.backup", { resource: "system", targetId: doc._id, newValue: { size: b.size, includeData } });
    return res.status(201).json({ status: "success", backup: { id: doc._id, collections: doc.collections, size: doc.size, checksum: doc.checksum, includeData, createdAt: doc.createdAt } });
  } catch (err) { console.error("[system/backup]", err.message); return res.status(500).json({ status: "error", message: "Backup failed" }); }
}
async function listBackups(req, res) {
  const items = await Backup.find({}).sort({ createdAt: -1 }).limit(50).select("kind collections includeData size checksum verified by createdAt").lean();
  return res.json({ status: "success", backups: items });
}
async function downloadBackup(req, res) {
  const b = await Backup.findById(req.params.id).lean();
  if (!b) return res.status(404).json({ status: "error", message: "Not found" });
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="backup-${b._id}.json"`);
  let parsed = {}; try { parsed = JSON.parse(b.data || "{}"); } catch (_) { /* */ }
  return res.send(JSON.stringify({ meta: { createdAt: b.createdAt, checksum: b.checksum }, data: parsed }, null, 2));
}
async function verifyBackup(req, res) {
  const b = await Backup.findById(req.params.id);
  if (!b) return res.status(404).json({ status: "error", message: "Not found" });
  const ok = backupSvc.verify(b.data, b.checksum);
  b.verified = ok; await b.save();
  return res.json({ status: "success", verified: ok });
}
async function restoreBackup(req, res) {
  try {
    if (!(req.body || {}).confirm) return res.status(400).json({ status: "error", message: "Restore is destructive — pass confirm:true" });
    let data;
    if (req.params.id) { const b = await Backup.findById(req.params.id).lean(); if (!b) return res.status(404).json({ status: "error", message: "Backup not found" }); if (!backupSvc.verify(b.data, b.checksum)) return res.status(400).json({ status: "error", message: "Backup failed verification — not restoring" }); data = b.data; }
    else { data = (req.body || {}).data; if (!data || typeof data !== "object") return res.status(400).json({ status: "error", message: "No backup data provided" }); }
    const results = await backupSvc.restore(data);
    provider.invalidate();
    await audit.record(req, "system.restore", { resource: "system", newValue: { results } });
    return res.json({ status: "success", results, note: "Users, sessions and audit log were preserved (never restored)." });
  } catch (err) { console.error("[system/restore]", err.message); return res.status(500).json({ status: "error", message: "Restore failed" }); }
}

/* ---- audit export (CSV) ---- */
async function auditExport(req, res) {
  const filter = {};
  if (req.query.action) filter.action = req.query.action;
  if (req.query.user) filter.userEmail = new RegExp(String(req.query.user), "i");
  if (req.query.resource) filter.resource = req.query.resource;
  const rows = await AuditLog.find(filter).sort({ at: -1 }).limit(50000).lean();
  const cell = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const head = ["Time", "User", "Action", "Resource", "Target", "IP"].join(",");
  const body = rows.map((r) => [new Date(r.at).toISOString(), r.userEmail, r.action, r.resource, r.targetId, r.ip].map(cell).join(",")).join("\n");
  await audit.record(req, "audit.export", { resource: "system", newValue: { rows: rows.length } });
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="audit-${new Date().toISOString().slice(0, 10)}.csv"`);
  return res.send("﻿" + head + "\n" + body + "\n");
}

module.exports = { overview, health, storage, queue, logs, environment, security, notifications, getMaintenance, setMaintenance, createBackup, listBackups, downloadBackup, verifyBackup, restoreBackup, auditExport };
