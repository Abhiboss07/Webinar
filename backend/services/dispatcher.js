"use strict";
/**
 * Sends a Message via its channel + the configured provider. Providers:
 *   email    → smtp (nodemailer) | mock (simulate)
 *   whatsapp → mock (simulate) | meta (Cloud API)
 * `mock` lets the whole queue/retry/schedule pipeline run without real creds.
 * Returns { providerResult } on success; throws on failure (→ queue retries).
 */
const provider = require("./settingsProvider");
const emailService = require("./emailService");
const { buildPdf } = require("./invoice");
const { buildIcs } = require("./ics");
const Registration = require("../models/Registration");

async function buildAttachments(msg) {
  const out = [];
  for (const a of msg.attachments || []) {
    try {
      if (a.kind === "receipt" || a.kind === "invoice") {
        const reg = await Registration.findById(a.ref).lean();
        if (reg) out.push({ filename: a.filename || `${a.kind}.pdf`, content: await buildPdf(reg, a.kind === "invoice" ? "Invoice" : "Receipt", {}) });
      } else if (a.kind === "ics") {
        const facts = (() => { try { return JSON.parse(a.ref); } catch { return {}; } })();
        out.push({ filename: a.filename || "invite.ics", content: buildIcs(facts) });
      } else if (a.kind === "certificate") {
        const Certificate = require("../models/Certificate");
        const CertificateTemplate = require("../models/CertificateTemplate");
        const { buildCertificatePdf } = require("./certificate");
        const config = require("../config");
        const cert = await Certificate.findById(a.ref).lean();
        if (cert) {
          const tpl = await CertificateTemplate.getSingleton();
          const verifyUrl = `${process.env.CERT_VERIFY_URL || config.storage.publicBaseUrl + "/verify"}?n=${encodeURIComponent(cert.certificateNumber)}&t=${encodeURIComponent(cert.verifyToken)}`;
          out.push({ filename: a.filename || `${cert.certificateNumber}.pdf`, content: await buildCertificatePdf(cert, tpl, verifyUrl) });
        }
      }
    } catch (_) { /* skip a broken attachment rather than fail the send */ }
  }
  return out;
}

async function sendEmail(msg) {
  const comm = await provider.communication();
  if (comm.emailProvider === "mock") return { providerResult: { mock: true, at: new Date() } };
  const attachments = await buildAttachments(msg);
  const r = await emailService.send({ to: msg.to, subject: msg.subject, html: msg.body, text: msg.body.replace(/<[^>]+>/g, " "), attachments });
  return { providerResult: { messageId: r.messageId, accepted: r.accepted } };
}

async function sendWhatsApp(msg) {
  const comm = await provider.communication();
  const wa = comm.whatsapp || {};
  if (!wa.provider || wa.provider === "mock") return { providerResult: { mock: true, at: new Date() } };
  if (wa.provider === "meta") {
    if (!wa.phoneNumberId || !wa.accessToken) throw new Error("WhatsApp (meta) not configured");
    const res = await fetch(`https://graph.facebook.com/v20.0/${wa.phoneNumberId}/messages`, {
      method: "POST",
      headers: { Authorization: `Bearer ${wa.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", to: msg.to, type: "text", text: { body: msg.body } }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((j.error && j.error.message) || `WhatsApp send failed (${res.status})`);
    return { providerResult: j };
  }
  throw new Error(`WhatsApp provider "${wa.provider}" not implemented`);
}

async function dispatch(msg) {
  return msg.channel === "whatsapp" ? sendWhatsApp(msg) : sendEmail(msg);
}

module.exports = { dispatch };
