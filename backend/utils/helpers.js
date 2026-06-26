"use strict";
/** Small shared helpers. */

/** Coerce any value to a trimmed string (null/undefined → ""). */
function clean(v) {
  return (v == null ? "" : String(v)).trim();
}

/** Basic email shape check. */
function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(v));
}

/** A receipt id for Razorpay orders (<= 40 chars). */
function receiptFor(regId) {
  return ("rcpt_" + clean(regId)).slice(0, 40) || `rcpt_${Date.now()}`;
}

module.exports = { clean, isEmail, receiptFor };
