"use strict";
const MessageTemplate = require("../models/MessageTemplate");
const Message = require("../models/Message");
const Registration = require("../models/Registration");
const commQueue = require("../services/commQueue");
const provider = require("../services/settingsProvider");
const audit = require("../services/audit");
const { render, buildContext, variablesIn } = require("../services/templateEngine");
const { clean } = require("../utils/helpers");

/* ---------------- dashboard ---------------- */
async function dashboard(req, res) {
  try {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const sentOk = { $in: ["sent", "delivered"] };
    const [emailToday, waToday, queued, failed, sent, engage, recent] = await Promise.all([
      Message.countDocuments({ channel: "email", status: sentOk, sentAt: { $gte: today } }),
      Message.countDocuments({ channel: "whatsapp", status: sentOk, sentAt: { $gte: today } }),
      Message.countDocuments({ status: "queued" }),
      Message.countDocuments({ status: "failed" }),
      Message.countDocuments({ status: sentOk }),
      Message.aggregate([{ $group: { _id: null, opens: { $sum: "$opens" }, clicks: { $sum: "$clicks" } } }]),
      Message.find({}).sort({ createdAt: -1 }).limit(10).select("channel to templateKey trigger status createdAt sentAt").lean(),
    ]);
    return res.json({
      status: "success",
      cards: { emailToday, whatsappToday: waToday, queued, failed, sent, opened: (engage[0] && engage[0].opens) || 0, clicked: (engage[0] && engage[0].clicks) || 0 },
      paused: await commQueue.isPaused(),
      recent,
    });
  } catch (err) { return res.status(500).json({ status: "error", message: "Could not load dashboard" }); }
}

/* ---------------- templates ---------------- */
async function listTemplates(req, res) {
  const filter = {};
  if (req.query.channel) filter.channel = req.query.channel;
  const templates = await MessageTemplate.find(filter).sort({ channel: 1, name: 1 }).lean();
  return res.json({ status: "success", templates });
}
async function getTemplate(req, res) {
  const t = await MessageTemplate.findById(req.params.id).lean();
  if (!t) return res.status(404).json({ status: "error", message: "Not found" });
  return res.json({ status: "success", template: t, variables: variablesIn(t.subject + " " + t.body) });
}
async function createTemplate(req, res) {
  try {
    const b = req.body || {};
    const key = clean(b.key).toLowerCase().replace(/[^a-z0-9_.]+/g, "_") || ("tpl_" + Date.now());
    if (await MessageTemplate.exists({ key })) return res.status(409).json({ status: "error", message: "Template key exists" });
    const t = await MessageTemplate.create({ channel: b.channel === "whatsapp" ? "whatsapp" : "email", key, name: clean(b.name) || key, category: clean(b.category) || "general", trigger: clean(b.trigger) || "manual", subject: b.subject || "", body: b.body || "", whatsapp: b.whatsapp || {}, updatedBy: req.user.id });
    await audit.record(req, "template.create", { resource: "communication", targetId: t.key });
    return res.status(201).json({ status: "success", template: t });
  } catch (err) { return res.status(500).json({ status: "error", message: "Could not create template" }); }
}
async function updateTemplate(req, res) {
  try {
    const t = await MessageTemplate.findById(req.params.id);
    if (!t) return res.status(404).json({ status: "error", message: "Not found" });
    const b = req.body || {};
    if (b.subject !== undefined || b.body !== undefined) { t.history.unshift({ subject: t.subject, body: t.body, at: new Date(), by: req.user.email }); t.history = t.history.slice(0, 15); t.version += 1; }
    for (const f of ["name", "category", "trigger", "subject", "body"]) if (b[f] !== undefined) t[f] = b[f];
    if (typeof b.enabled === "boolean") t.enabled = b.enabled;
    if (b.whatsapp) t.whatsapp = b.whatsapp;
    t.updatedBy = req.user.id; t.markModified("whatsapp");
    await t.save();
    await audit.record(req, "template.update", { resource: "communication", targetId: t.key });
    return res.json({ status: "success", template: t });
  } catch (err) { return res.status(500).json({ status: "error", message: "Could not update template" }); }
}
async function duplicateTemplate(req, res) {
  const src = await MessageTemplate.findById(req.params.id).lean();
  if (!src) return res.status(404).json({ status: "error", message: "Not found" });
  const key = `${src.key}_copy_${Date.now().toString(36)}`;
  const copy = await MessageTemplate.create({ ...src, _id: undefined, key, name: `${src.name} (Copy)`, trigger: "manual", version: 1, history: [], createdAt: undefined, updatedAt: undefined });
  return res.status(201).json({ status: "success", template: copy });
}
async function deleteTemplate(req, res) {
  const t = await MessageTemplate.findByIdAndDelete(req.params.id);
  if (!t) return res.status(404).json({ status: "error", message: "Not found" });
  await audit.record(req, "template.delete", { resource: "communication", targetId: t.key });
  return res.json({ status: "success" });
}
async function previewTemplate(req, res) {
  const b = req.body || {};
  const sample = { fullName: "Priya Nair", email: "priya@example.com", mobile: "9876543210", profession: "Nurse", city: "Chennai", workshop: "Career Growth Workshop", amount: 99, currency: "INR", paymentStatus: "Paid", regId: "reg_demo" };
  const ctx = buildContext(sample, { date: "29 June 2026", time: "10 AM – 1 PM", venue: "Live Online", certificate_link: "https://example.com/cert/demo" });
  return res.json({ status: "success", subject: render(b.subject || "", ctx), body: render(b.body || "", ctx) });
}

/* ---------------- history / queue ---------------- */
async function history(req, res) {
  try {
    const filter = {};
    if (req.query.channel) filter.channel = req.query.channel;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.trigger) filter.trigger = req.query.trigger;
    if (req.query.q) filter.to = new RegExp(clean(req.query.q), "i");
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "25", 10), 1), 200);
    const [items, total] = await Promise.all([
      Message.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Message.countDocuments(filter),
    ]);
    return res.json({ status: "success", items, page, limit, total, pages: Math.ceil(total / limit) });
  } catch (err) { return res.status(500).json({ status: "error", message: "Could not load history" }); }
}
async function processQueue(req, res) { try { return res.json({ status: "success", ...(await commQueue.processDue(100)) }); } catch (e) { return res.status(500).json({ status: "error", message: e.message }); } }
async function retryQueue(req, res) { const n = await commQueue.retryFailed((req.body || {}).ids); await audit.record(req, "queue.retry", { resource: "communication", newValue: { n } }); return res.json({ status: "success", retried: n }); }
async function cancelQueue(req, res) { const n = await commQueue.cancel((req.body || {}).ids); return res.json({ status: "success", cancelled: n }); }
async function pauseQueue(req, res) { const p = await commQueue.setPaused((req.body || {}).paused !== false); await audit.record(req, "queue.pause", { resource: "communication", newValue: { paused: p } }); return res.json({ status: "success", paused: p }); }

/* ---------------- sending ---------------- */
function audienceFilter(b) {
  if (Array.isArray(b.ids) && b.ids.length) return { _id: { $in: b.ids } };
  const f = {};
  const map = { paid: "Paid", pending: "Pending", failed: "Failed" };
  if (b.audience && map[b.audience]) f.paymentStatus = map[b.audience];
  if (b.status) f.paymentStatus = b.status;
  if (b.workshop) f.workshop = b.workshop;
  if (b.profession) f.profession = b.profession;
  if (b.city) f.city = new RegExp(clean(b.city), "i");
  if (b.dateFrom || b.dateTo) { f.createdAt = {}; if (b.dateFrom) f.createdAt.$gte = new Date(b.dateFrom); if (b.dateTo) { const d = new Date(b.dateTo); d.setHours(23, 59, 59, 999); f.createdAt.$lte = d; } }
  return f;
}

async function sendBulk(req, res) {
  try {
    const b = req.body || {};
    const tpl = await MessageTemplate.findOne(b.templateId ? { _id: b.templateId } : { key: b.templateKey });
    if (!tpl) return res.status(400).json({ status: "error", message: "Template not found" });
    const scheduledFor = b.scheduledFor ? new Date(b.scheduledFor) : new Date();
    const regs = await Registration.find(audienceFilter(b)).limit(20000).lean();
    let enqueued = 0;
    for (const reg of regs) {
      const to = tpl.channel === "email" ? reg.email : reg.mobile;
      if (!to) continue;
      const ctx = buildContext(reg, { date: b.date, time: b.time, venue: b.venue });
      await commQueue.enqueue({ channel: tpl.channel, to, name: reg.fullName, registrationId: reg._id, templateKey: tpl.key, trigger: "manual", subject: render(tpl.subject, ctx), body: render(tpl.body, ctx), scheduledFor, createdBy: req.user.id });
      enqueued += 1;
    }
    await audit.record(req, "comm.bulk_send", { resource: "communication", newValue: { template: tpl.key, enqueued } });
    return res.json({ status: "success", enqueued });
  } catch (err) { console.error("[comm/bulk]", err.message); return res.status(500).json({ status: "error", message: "Bulk send failed" }); }
}

async function sendTest(req, res) {
  try {
    const b = req.body || {};
    const to = clean(b.to);
    if (!to) return res.status(400).json({ status: "error", message: "Recipient required" });
    const tpl = b.templateId ? await MessageTemplate.findById(b.templateId).lean() : null;
    const ctx = buildContext({ fullName: "Test User", email: to, mobile: to }, { date: "29 June 2026", time: "10 AM", venue: "Online" });
    const msg = await commQueue.enqueue({
      channel: (tpl && tpl.channel) || b.channel || "email", to,
      templateKey: tpl ? tpl.key : "", trigger: "test", maxRetries: 0, // a test send fails fast (no retry loop)
      subject: render((tpl && tpl.subject) || "Test message", ctx), body: render((tpl && tpl.body) || "This is a test message from Youngness CMS.", ctx),
      createdBy: req.user.id,
    });
    await commQueue.processDue(5);
    const done = await Message.findById(msg._id).lean();
    await audit.record(req, "comm.test", { resource: "communication", newValue: { to, status: done.status } });
    return res.json({ status: "success", message: done });
  } catch (err) { return res.status(500).json({ status: "error", message: err.message }); }
}

/* ---------------- triggers (flat dotted keys) ---------------- */
async function getTriggers(req, res) {
  const comm = await provider.communication();
  return res.json({ status: "success", triggers: comm.triggers || {} });
}
async function setTriggers(req, res) {
  try {
    const incoming = (req.body || {}).triggers;
    if (!incoming || typeof incoming !== "object") return res.status(400).json({ status: "error", message: "triggers object required" });
    const Settings = require("../models/Settings");
    const doc = await Settings.getSingleton();
    const data = doc.data || {};
    data.communication = data.communication || {};
    data.communication.triggers = { ...(data.communication.triggers || {}), ...incoming };
    doc.data = data; doc.markModified("data");
    await doc.save();
    provider.invalidate();
    await audit.record(req, "comm.triggers", { resource: "communication", newValue: incoming });
    return res.json({ status: "success", triggers: data.communication.triggers });
  } catch (err) { return res.status(500).json({ status: "error", message: "Could not update triggers" }); }
}

module.exports = { dashboard, listTemplates, getTemplate, createTemplate, updateTemplate, duplicateTemplate, deleteTemplate, previewTemplate, history, processQueue, retryQueue, cancelQueue, pauseQueue, sendBulk, sendTest, getTriggers, setTriggers };
