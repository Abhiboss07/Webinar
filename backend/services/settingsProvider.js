"use strict";
/**
 * Settings provider — the single runtime source for integration config. Merges
 * DEFAULTS + DB settings (secrets decrypted), falling back to env so behaviour is
 * unchanged until the client sets a value in the admin. Short in-memory cache;
 * invalidate() is called whenever settings are saved.
 */
const config = require("../config");
const Settings = require("../models/Settings");
const { DEFAULTS, SECRET_PATHS, getPath, setPath, deepMerge } = require("../config/settingsMeta");
const { decrypt, mask, isEncrypted } = require("./cryptoBox");

let cache = null; // { data, ts }
const TTL = 10000;

/** Effective settings with secrets DECRYPTED (runtime use only — never serialised to clients). */
async function effective() {
  if (cache && Date.now() - cache.ts < TTL) return cache.data;
  let stored = {};
  try { const doc = await Settings.getSingleton(); stored = doc.data || {}; } catch (_) { stored = {}; }
  const merged = deepMerge(DEFAULTS, stored);
  for (const p of SECRET_PATHS) { const v = getPath(merged, p); if (isEncrypted(v)) setPath(merged, p, decrypt(v)); }
  cache = { data: merged, ts: Date.now() };
  return merged;
}
function invalidate() { cache = null; }

/** Admin view: full config, secrets replaced with { set, masked } (never plaintext). */
async function maskedView() {
  const doc = await Settings.getSingleton();
  const merged = deepMerge(DEFAULTS, doc.data || {});
  for (const p of SECRET_PATHS) {
    const enc = getPath(merged, p);
    const plain = isEncrypted(enc) ? decrypt(enc) : "";
    setPath(merged, p, { set: !!plain, masked: plain ? mask(plain) : "" });
  }
  return merged;
}

/** Public, non-secret subset the frontend + admin may consume (branding/theme). */
async function publicView() {
  const s = await effective();
  return {
    general: {
      siteName: s.general.siteName, primaryColor: s.general.primaryColor, secondaryColor: s.general.secondaryColor,
      logo: s.general.logo, favicon: s.general.favicon, currency: s.general.currency,
      typography: s.general.typography, borderRadius: s.general.borderRadius, buttonStyle: s.general.buttonStyle,
      adminFooter: s.general.adminFooter, poweredBy: s.general.poweredBy,
    },
    seo: { title: s.seo.defaultTitle, description: s.seo.metaDescription, keywords: s.seo.keywords, ogImage: s.seo.ogImage, canonical: s.seo.canonicalUrl, robots: s.seo.robots, googleVerification: s.seo.googleVerification, schema: s.seo.schema },
    contact: s.contact,
    social: Object.fromEntries(Object.entries(s.social).filter(([, v]) => v && v.enabled).map(([k, v]) => [k, v.url])),
    analytics: { ga: s.google.analyticsId, gtm: s.google.tagManagerId },
    maintenance: s.security.maintenance,
    buttons: (s.branding && s.branding.buttons) || null, // public-site button theme
  };
}

/* ---- runtime accessors (DB → env fallback) ---- */
async function razorpay() {
  const s = await effective();
  const active = s.payment.mode === "live" ? s.payment.live : s.payment.test;
  return {
    mode: s.payment.mode,
    keyId: active.keyId || config.razorpay.keyId,
    keySecret: active.keySecret || config.razorpay.keySecret,
    webhookSecret: active.webhookSecret || "",
  };
}
async function cloudinary() {
  const c = (await effective()).media.cloudinary;
  return {
    cloudName: c.cloudName || config.cloudinary.cloudName,
    apiKey: c.apiKey || config.cloudinary.apiKey,
    apiSecret: c.apiSecret || config.cloudinary.apiSecret,
    baseFolder: c.folder || config.cloudinary.baseFolder,
  };
}
async function sheets() {
  const g = (await effective()).google.sheets;
  return { endpoint: g.appsScriptUrl || config.sheet.endpoint, token: g.sharedToken || config.sheet.token, spreadsheetId: g.spreadsheetId };
}
async function smtp() { return (await effective()).email.smtp; }
async function security() { return (await effective()).security; }
async function communication() { return (await effective()).communication; }

const exported = { effective, invalidate, maskedView, publicView, razorpay, cloudinary, sheets, smtp, security, communication };
// Expose the in-memory cache (read-only) so the storage facade can
// synchronously peek at it to decide cloudinary vs local adapter
// without incurring an async DB read on every upload.
Object.defineProperty(exported, "_cache", { get: () => cache });
module.exports = exported;
