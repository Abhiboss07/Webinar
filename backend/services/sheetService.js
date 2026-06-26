"use strict";
/**
 * Google Sheets persistence via the deployed Apps Script Web App.
 * The browser never calls this directly — only this backend does, and it sends
 * the shared token so the Apps Script accepts the write. Requires Node 18+
 * (global fetch).
 */
const config = require("../config");

async function callSheet(payload) {
  if (!config.sheet.endpoint) throw new Error("GOOGLE_SHEET_ENDPOINT is not configured");
  const res = await fetch(config.sheet.endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(Object.assign({ token: config.sheet.token }, payload)),
    redirect: "follow",
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) {
    throw new Error(`Sheet endpoint returned non-JSON: ${text.slice(0, 200)}`);
  }
  if (!json || json.result !== "success") {
    throw new Error((json && json.message) || "Sheet write failed");
  }
  return json;
}

/** Insert/upsert a Pending registration. `reg` keys become sheet columns. */
async function saveRegistration(reg) {
  return callSheet(Object.assign({ action: "register" }, reg));
}

/** Flip a registration to Paid and store the payment details. */
async function markPaid(regId, payment) {
  return callSheet(Object.assign({ action: "markPaid", regId }, payment));
}

module.exports = { saveRegistration, markPaid };
