"use strict";
/** Email via SMTP (nodemailer), configured from Settings → Email. Used for the
 *  "send test email" action now and by later modules (invites, receipts). */
const nodemailer = require("nodemailer");
const provider = require("./settingsProvider");

async function getTransport() {
  const s = await provider.smtp();
  if (!s.host) throw new Error("SMTP is not configured (Settings → Email)");
  return nodemailer.createTransport({
    host: s.host,
    port: Number(s.port) || 587,
    secure: s.encryption === "ssl" || Number(s.port) === 465,
    auth: s.username ? { user: s.username, pass: s.password } : undefined,
  });
}

/** Verify SMTP credentials/connection. */
async function verify() {
  const t = await getTransport();
  await t.verify();
  return true;
}

async function send({ to, subject, html, text, attachments }) {
  const s = await provider.smtp();
  const comm = await provider.communication().catch(() => ({}));
  const t = await getTransport();
  return t.sendMail({
    from: `"${s.fromName || "Youngness Institute"}" <${s.fromEmail || s.username}>`,
    replyTo: comm && comm.replyTo ? comm.replyTo : undefined,
    to, subject, html, text, attachments,
  });
}

module.exports = { getTransport, verify, send };
