"use strict";
const crypto = require("crypto");

/** Strong-ish password policy. Returns an error string, or null if OK. */
function validatePassword(pw) {
  const s = String(pw || "");
  if (s.length < 8) return "Password must be at least 8 characters";
  if (!/[a-zA-Z]/.test(s)) return "Password must contain a letter";
  if (!/[0-9]/.test(s)) return "Password must contain a number";
  if (/^(password|12345678|qwerty)/i.test(s)) return "Password is too common";
  return null;
}

const randomToken = () => crypto.randomBytes(32).toString("hex");
const sha256 = (v) => crypto.createHash("sha256").update(String(v)).digest("hex");

module.exports = { validatePassword, randomToken, sha256 };
