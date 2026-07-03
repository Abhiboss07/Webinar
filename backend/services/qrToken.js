"use strict";
/** Encrypted QR tokens for check-in. The token is an AES-256-GCM ciphertext of
 *  { r: regId, w: workshopId, t: issuedAt } — opaque and tamper-proof. */
const QRCode = require("qrcode");
const { encrypt, decrypt } = require("./cryptoBox");

function makeToken(regId, workshopId = "") {
  return encrypt(JSON.stringify({ r: String(regId), w: String(workshopId || ""), t: Date.now() }));
}
function readToken(token) {
  try { const o = JSON.parse(decrypt(token)); return o && o.r ? { regId: o.r, workshopId: o.w } : null; }
  catch (_) { return null; }
}
/** PNG data URL for any text/URL. */
function dataUrl(text) {
  return QRCode.toDataURL(String(text), { margin: 1, width: 320, errorCorrectionLevel: "M" });
}

module.exports = { makeToken, readToken, dataUrl };
