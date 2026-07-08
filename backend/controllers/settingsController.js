"use strict";
const os = require("os");
const fs = require("fs");
const config = require("../config");
const Razorpay = require("razorpay");
const { v2: cloudinary } = require("cloudinary");
const Settings = require("../models/Settings");
const provider = require("../services/settingsProvider");
const razorpayService = require("../services/razorpayService");
const emailService = require("../services/emailService");
const audit = require("../services/audit");
const { mongoose } = require("../db/connect");
const { DEFAULTS, SECRET_PATHS, SECTIONS, getPath, setPath, deepMerge } = require("../config/settingsMeta");
const { encrypt } = require("../services/cryptoBox");

/** Admin: full settings, secrets masked (never plaintext). */
async function getAdmin(req, res) {
  try { return res.json({ status: "success", settings: await provider.maskedView(), sections: SECTIONS }); }
  catch (err) { return res.status(500).json({ status: "error", message: "Could not load settings" }); }
}

/** Public: non-secret subset for the frontend. */
async function getPublicSettings(req, res) {
  try { res.set("Cache-Control", "public, max-age=30"); return res.json({ status: "success", settings: await provider.publicView() }); }
  catch (err) { return res.status(500).json({ status: "error", message: "Could not load settings" }); }
}

/** Admin: update one section. Empty secret fields are kept (write-only secrets). */
async function update(req, res) {
  try {
    const section = String((req.body || {}).section || "");
    const values = (req.body || {}).values;
    if (!SECTIONS.includes(section)) return res.status(400).json({ status: "error", message: "Unknown settings section" });
    if (!values || typeof values !== "object" || Array.isArray(values)) return res.status(400).json({ status: "error", message: "values must be an object" });

    const doc = await Settings.getSingleton();
    const stored = doc.data || {};
    let merged = deepMerge(stored, { [section]: values });

    // Handle secrets: encrypt new values; keep existing when the field is blank.
    for (const p of SECRET_PATHS.filter((x) => x.startsWith(section + "."))) {
      const incoming = getPath({ [section]: values }, p);
      const existing = getPath(stored, p) || "";
      if (incoming === undefined) continue;                 // not submitted → deepMerge kept existing
      if (incoming === "" || incoming === null) setPath(merged, p, existing); // blank → keep existing secret
      else setPath(merged, p, encrypt(String(incoming)));   // new value → encrypt
    }

    doc.history.unshift({ data: stored, at: new Date(), by: (req.user && req.user.email) || "" });
    doc.history = doc.history.slice(0, Settings.HISTORY_CAP);
    doc.data = merged; doc.updatedBy = req.user ? req.user.id : null;
    doc.markModified("data"); doc.markModified("history");
    await doc.save();
    provider.invalidate(); razorpayService.invalidate();
    await audit.record(req, "settings.update", { resource: "settings", targetId: section, newValue: { section } });
    return res.json({ status: "success", settings: await provider.maskedView() });
  } catch (err) {
    console.error("[settings/update]", err.message);
    return res.status(500).json({ status: "error", message: "Could not save settings" });
  }
}

/** Admin: test an integration connection (safe, no data changes). */
async function testConnection(req, res) {
  const target = String((req.body || {}).target || "");
  try {
    if (target === "razorpay") {
      const { keyId, keySecret } = await provider.razorpay();
      if (!keyId || !keySecret) return res.json({ ok: false, message: "No Razorpay keys configured" });
      const inst = new Razorpay({ key_id: keyId, key_secret: keySecret });
      await inst.orders.all({ count: 1 });
      return res.json({ ok: true, message: "Razorpay keys are valid" });
    }
    if (target === "cloudinary") {
      const c = await provider.cloudinary();
      if (!c.cloudName) return res.json({ ok: false, message: "No Cloudinary config" });
      cloudinary.config({ cloud_name: c.cloudName, api_key: c.apiKey, api_secret: c.apiSecret, secure: true });
      const r = await cloudinary.api.ping();
      return res.json({ ok: r && r.status === "ok", message: "Cloudinary reachable" });
    }
    if (target === "smtp") { await emailService.verify(); return res.json({ ok: true, message: "SMTP connection OK" }); }
    if (target === "sheets") {
      const { endpoint } = await provider.sheets();
      if (!endpoint) return res.json({ ok: false, message: "No Google Sheets endpoint" });
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 8000);
      const r = await fetch(endpoint, { signal: ctrl.signal }).finally(() => clearTimeout(t));
      return res.json({ ok: r.ok, message: r.ok ? "Endpoint reachable" : `Endpoint returned ${r.status}` });
    }
    return res.status(400).json({ status: "error", message: "Unknown target" });
  } catch (err) {
    // Surface the provider's REAL error. Razorpay throws {error:{description}},
    // the Cloudinary SDK rejects with a plain {error:{message,http_code}} object
    // (no top-level .message), network failures carry .code — the old fallback
    // collapsed all of these into a useless "Connection failed".
    console.error(`[settings/test] ${target} failed:`, err);
    const e = err || {};
    const detail = (e.error && (e.error.description || e.error.message))
      || e.message || e.code || (typeof e === "string" ? e : "");
    const http = (e.error && e.error.http_code) || e.http_code || e.statusCode || null;
    return res.json({ ok: false, message: (http ? `HTTP ${http}: ` : "") + (detail || "Connection failed") });
  }
}

async function sendTestEmail(req, res) {
  try {
    const to = String((req.body || {}).to || "").trim();
    if (!to) return res.status(400).json({ status: "error", message: "Recipient email required" });
    await emailService.send({ to, subject: "Youngness CMS — test email", html: "<p>✅ Your SMTP settings work. This is a test email from the Youngness admin.</p>", text: "SMTP settings work." });
    await audit.record(req, "settings.test_email", { resource: "settings", newValue: { to } });
    return res.json({ status: "success", message: `Test email sent to ${to}` });
  } catch (err) {
    return res.status(502).json({ status: "error", message: (err && err.message) || "Could not send email" });
  }
}

/** Admin: environment / integration health with green/red indicators. */
async function diagnostics(req, res) {
  const checks = [];
  const add = (label, ok, detail) => checks.push({ label, ok, detail });

  add("Database", mongoose.connection.readyState === 1, mongoose.connection.readyState === 1 ? "connected" : "disconnected");
  try { const info = await mongoose.connection.db.admin().serverInfo(); add("MongoDB version", true, info.version); } catch (_) { add("MongoDB version", false, "unknown"); }
  try { const rp = await provider.razorpay(); add("Razorpay", !!(rp.keyId && rp.keySecret), rp.keyId ? `configured (${rp.mode})` : "not configured"); } catch (_) { add("Razorpay", false, "error"); }
  try { const c = await provider.cloudinary(); add("Cloudinary", !!c.cloudName, c.cloudName ? "configured" : "not configured (local storage)"); } catch (_) { add("Cloudinary", false, "error"); }
  try { const g = await provider.sheets(); add("Google Sheets", !!g.endpoint, g.endpoint ? "endpoint set" : "not configured"); } catch (_) { add("Google Sheets", false, "error"); }
  try { const s = await provider.smtp(); add("SMTP", !!s.host, s.host ? `${s.host}:${s.port}` : "not configured"); } catch (_) { add("SMTP", false, "error"); }

  add("Node.js", true, process.version);
  const totalMem = os.totalmem(), freeMem = os.freemem();
  add("Memory", freeMem / totalMem > 0.05, `${Math.round((totalMem - freeMem) / 1048576)}MB / ${Math.round(totalMem / 1048576)}MB used`);
  try { const st = fs.statfsSync ? fs.statfsSync("/") : null; if (st) { const freeGB = (st.bavail * st.bsize) / 1e9, totalGB = (st.blocks * st.bsize) / 1e9; add("Disk", freeGB / totalGB > 0.05, `${freeGB.toFixed(1)}GB free / ${totalGB.toFixed(1)}GB`); } else add("Disk", true, "n/a"); } catch (_) { add("Disk", true, "n/a"); }
  add("API", true, `uptime ${Math.round(process.uptime())}s`);

  return res.json({ status: "success", checks, healthy: checks.every((c) => c.ok) });
}

/** Backup: export the raw stored settings (secrets stay encrypted) as JSON. */
async function exportSettings(req, res) {
  const doc = await Settings.getSingleton();
  await audit.record(req, "settings.export", { resource: "settings" });
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="settings-${new Date().toISOString().slice(0, 10)}.json"`);
  return res.send(JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), data: doc.data || {} }, null, 2));
}

async function importSettings(req, res) {
  try {
    // Accepts the exported file shape { data: {...} } or a bare settings object.
    const payload = (req.body && req.body.data) || req.body;
    if (!payload || typeof payload !== "object" || Array.isArray(payload) || payload.data) return res.status(400).json({ status: "error", message: "Body must include a settings data object" });
    const doc = await Settings.getSingleton();
    doc.history.unshift({ data: doc.data || {}, at: new Date(), by: (req.user && req.user.email) || "" });
    doc.history = doc.history.slice(0, Settings.HISTORY_CAP);
    doc.data = payload; doc.markModified("data"); doc.markModified("history");
    await doc.save();
    provider.invalidate(); razorpayService.invalidate();
    await audit.record(req, "settings.import", { resource: "settings" });
    return res.json({ status: "success", settings: await provider.maskedView() });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Import failed" });
  }
}

async function restoreDefaults(req, res) {
  try {
    const doc = await Settings.getSingleton();
    doc.history.unshift({ data: doc.data || {}, at: new Date(), by: (req.user && req.user.email) || "" });
    doc.history = doc.history.slice(0, Settings.HISTORY_CAP);
    doc.data = {}; doc.markModified("data"); doc.markModified("history");
    await doc.save();
    provider.invalidate(); razorpayService.invalidate();
    await audit.record(req, "settings.restore_defaults", { resource: "settings" });
    return res.json({ status: "success", settings: await provider.maskedView() });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Could not restore defaults" });
  }
}

async function history(req, res) {
  const doc = await Settings.getSingleton();
  return res.json({ status: "success", history: (doc.history || []).map((h, i) => ({ index: i, at: h.at, by: h.by })) });
}

async function revert(req, res) {
  try {
    const index = parseInt((req.body || {}).index, 10);
    const doc = await Settings.getSingleton();
    const snap = (doc.history || [])[index];
    if (!snap) return res.status(404).json({ status: "error", message: "Snapshot not found" });
    const current = doc.data || {};
    doc.data = snap.data; doc.history.unshift({ data: current, at: new Date(), by: (req.user && req.user.email) || "" });
    doc.history = doc.history.slice(0, Settings.HISTORY_CAP);
    doc.markModified("data"); doc.markModified("history");
    await doc.save();
    provider.invalidate(); razorpayService.invalidate();
    await audit.record(req, "settings.revert", { resource: "settings", newValue: { index } });
    return res.json({ status: "success", settings: await provider.maskedView() });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Could not revert" });
  }
}

/* ---- White-label: robots.txt / sitemap.xml (public) ---- */
async function robotsTxt(req, res) {
  try {
    const s = await provider.publicView();
    const base = String(s.seo.canonical || config.storage.publicBaseUrl).replace(/\/$/, "");
    const noindex = /noindex/i.test(s.seo.robots || "");
    res.type("text/plain").send(["User-agent: *", noindex ? "Disallow: /" : "Allow: /", `Sitemap: ${base}/sitemap.xml`].join("\n") + "\n");
  } catch (err) { res.type("text/plain").send("User-agent: *\nAllow: /\n"); }
}
async function sitemapXml(req, res) {
  try {
    const s = await provider.publicView();
    const base = String(s.seo.canonical || config.storage.publicBaseUrl).replace(/\/$/, "");
    const Workshop = require("../models/Workshop");
    const ws = await Workshop.find({ status: "published" }).select("slug updatedAt").lean();
    const urls = [`  <url><loc>${base}/</loc></url>`,
      ...ws.map((w) => `  <url><loc>${base}/?workshop=${encodeURIComponent(w.slug)}</loc><lastmod>${new Date(w.updatedAt).toISOString().slice(0, 10)}</lastmod></url>`)];
    res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`);
  } catch (err) { res.status(500).type("application/xml").send('<?xml version="1.0"?><urlset/>'); }
}

/* ---- Multi-brand: export / import / reset branding (no secrets involved) ---- */
const BRANDING_SECTIONS = ["general", "contact", "social", "seo", "branding"];
async function exportBranding(req, res) {
  const view = await provider.maskedView();
  const out = {}; for (const sec of BRANDING_SECTIONS) out[sec] = view[sec];
  await audit.record(req, "branding.export", { resource: "settings" });
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="branding-${new Date().toISOString().slice(0, 10)}.json"`);
  return res.send(JSON.stringify({ version: 1, branding: out }, null, 2));
}
async function importBranding(req, res) {
  try {
    const b = (req.body && (req.body.branding || req.body)) || {};
    const doc = await Settings.getSingleton();
    const data = doc.data || {};
    doc.history.unshift({ data: JSON.parse(JSON.stringify(data)), at: new Date(), by: (req.user && req.user.email) || "" });
    doc.history = doc.history.slice(0, Settings.HISTORY_CAP);
    for (const sec of BRANDING_SECTIONS) if (b[sec] && typeof b[sec] === "object") data[sec] = deepMerge(data[sec] || {}, b[sec]);
    doc.data = data; doc.markModified("data"); doc.markModified("history"); await doc.save();
    provider.invalidate();
    await audit.record(req, "branding.import", { resource: "settings" });
    return res.json({ status: "success", settings: await provider.maskedView() });
  } catch (err) { return res.status(500).json({ status: "error", message: "Branding import failed" }); }
}
async function resetBranding(req, res) {
  try {
    const doc = await Settings.getSingleton();
    const data = doc.data || {};
    doc.history.unshift({ data: JSON.parse(JSON.stringify(data)), at: new Date(), by: (req.user && req.user.email) || "" });
    doc.history = doc.history.slice(0, Settings.HISTORY_CAP);
    for (const sec of BRANDING_SECTIONS) delete data[sec]; // DEFAULTS re-apply via merge
    doc.data = data; doc.markModified("data"); doc.markModified("history"); await doc.save();
    provider.invalidate();
    await audit.record(req, "branding.reset", { resource: "settings" });
    return res.json({ status: "success", settings: await provider.maskedView() });
  } catch (err) { return res.status(500).json({ status: "error", message: "Branding reset failed" }); }
}

module.exports = { getAdmin, getPublicSettings, update, testConnection, sendTestEmail, diagnostics, exportSettings, importSettings, restoreDefaults, history, revert, robotsTxt, sitemapXml, exportBranding, importBranding, resetBranding };
