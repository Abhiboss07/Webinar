"use strict";
/**
 * Settings shape: default (non-secret) values + the list of secret paths.
 * Secrets are stored encrypted and never returned by the API (masked instead).
 */
const DEFAULTS = {
  general: { siteName: "Youngness Institute", timezone: "Asia/Kolkata", language: "en", dateFormat: "DD MMM YYYY", currency: "INR", primaryColor: "#1e3d52", secondaryColor: "#c8862b", typography: "DM Sans", logo: "", favicon: "" },
  contact: { phone: "", whatsapp: "", email: "", supportEmail: "", address: "", mapsLink: "" },
  social: { facebook: { url: "", enabled: false }, instagram: { url: "", enabled: false }, linkedin: { url: "", enabled: false }, youtube: { url: "", enabled: false }, twitter: { url: "", enabled: false } },
  payment: { provider: "razorpay", mode: "test", test: { keyId: "", keySecret: "", webhookSecret: "" }, live: { keyId: "", keySecret: "", webhookSecret: "" } },
  media: { cloudinary: { cloudName: "", apiKey: "", apiSecret: "", folder: "youngness" }, imageQuality: "auto", compression: true, video: { enabled: true } },
  email: { smtp: { host: "", port: 587, username: "", password: "", encryption: "tls", fromName: "Youngness Institute", fromEmail: "" } },
  google: { sheets: { spreadsheetId: "", appsScriptUrl: "", sharedToken: "" }, analyticsId: "", tagManagerId: "" },
  seo: { defaultTitle: "", metaDescription: "", keywords: "", ogImage: "", robots: "index, follow", canonicalUrl: "", googleVerification: "", schema: "" },
  security: { sessionTimeout: "12h", passwordMinLength: 8, maxLoginAttempts: 5, lockMinutes: 15, twoFactor: false, maintenance: { enabled: false, message: "We'll be back shortly." } },
  branding: { loaderLogo: "", emailLogo: "", invoiceLogo: "", certificateLogo: "", adminLogo: "" },
  communication: {
    emailProvider: "smtp",            // smtp | mock (mock = simulate, for testing/dev)
    replyTo: "", adminNotify: "",     // comma-separated admin notification recipients
    whatsapp: { provider: "mock", phoneNumberId: "", accessToken: "", from: "" }, // mock | meta | twilio
    triggers: {
      "registration.success": true, "payment.success": true, "payment.failed": false,
      "refund.processed": true, "workshop.reminder": false, "workshop.tomorrow": false,
      "workshop.started": false, "certificate.ready": false,
    },
  },
};

// Dot-paths that hold secrets (encrypted at rest, never returned).
const SECRET_PATHS = [
  "payment.test.keySecret", "payment.test.webhookSecret",
  "payment.live.keySecret", "payment.live.webhookSecret",
  "media.cloudinary.apiSecret", "email.smtp.password", "google.sheets.sharedToken",
  "communication.whatsapp.accessToken",
];

const SECTIONS = Object.keys(DEFAULTS);

function getPath(obj, path) { return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj); }
function setPath(obj, path, value) {
  const parts = path.split("."); const last = parts.pop();
  let o = obj; for (const k of parts) { if (o[k] == null || typeof o[k] !== "object") o[k] = {}; o = o[k]; }
  o[last] = value;
}
// Deep-merge source into a clone of base (objects only; arrays/scalars replace).
function deepMerge(base, src) {
  const out = Array.isArray(base) ? [...base] : { ...base };
  if (!src || typeof src !== "object") return out;
  for (const k of Object.keys(src)) {
    if (src[k] && typeof src[k] === "object" && !Array.isArray(src[k]) && out[k] && typeof out[k] === "object") out[k] = deepMerge(out[k], src[k]);
    else out[k] = src[k];
  }
  return out;
}

module.exports = { DEFAULTS, SECRET_PATHS, SECTIONS, getPath, setPath, deepMerge };
