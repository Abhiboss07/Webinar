"use strict";
/** Input validation for the API routes. Rejects bad payloads before the
 *  controllers run, so controllers stay focused on business logic. */
const { clean, isEmail } = require("../utils/helpers");

function validateRegistration(req, res, next) {
  const b = req.body || {};
  if (!clean(b.regId)) return res.status(400).json({ status: "error", message: "Missing regId" });
  if (!clean(b.fullName)) return res.status(400).json({ status: "error", message: "Full name is required" });
  if (!clean(b.mobile)) return res.status(400).json({ status: "error", message: "Mobile number is required" });
  if (!isEmail(b.email)) return res.status(400).json({ status: "error", message: "A valid email is required" });
  next();
}

function validateOrder(req, res, next) {
  if (!clean((req.body || {}).regId)) return res.status(400).json({ status: "error", message: "Missing regId" });
  next();
}

function validateVerify(req, res, next) {
  const b = req.body || {};
  if (!clean(b.regId) || !clean(b.razorpay_order_id) || !clean(b.razorpay_payment_id) || !clean(b.razorpay_signature)) {
    return res.status(400).json({ status: "failed", message: "Missing payment fields" });
  }
  next();
}

module.exports = { validateRegistration, validateOrder, validateVerify };
