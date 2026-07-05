"use strict";
/** Audit logging — best-effort (never blocks the request on failure). */
const AuditLog = require("../models/AuditLog");

function ipOf(req) {
  return (String(req.headers["x-forwarded-for"] || "").split(",")[0].trim())
    || req.ip || (req.socket && req.socket.remoteAddress) || "";
}

async function record(req, action, opts = {}) {
  try {
    await AuditLog.create({
      userId: (req.user && req.user.id) || null,
      userEmail: (req.user && req.user.email) || opts.email || "",
      action,
      resource: opts.resource || "",
      targetId: opts.targetId ? String(opts.targetId) : "",
      ip: ipOf(req),
      userAgent: String(req.headers["user-agent"] || "").slice(0, 300),
      oldValue: opts.oldValue !== undefined ? opts.oldValue : null,
      newValue: opts.newValue !== undefined ? opts.newValue : null,
    });
  } catch (e) {
    console.error("[audit] non-fatal:", e.message);
  }
}

module.exports = { record, ipOf };
