"use strict";
/**
 * Razorpay service — order creation + signature verification.
 * The Key Secret lives here (server-side) and is never sent to the client.
 */
const crypto = require("crypto");
const Razorpay = require("razorpay");
const config = require("../config");

const instance = new Razorpay({
  key_id: config.razorpay.keyId,
  key_secret: config.razorpay.keySecret,
});

/** Create an order. Amount is server-owned (config), not taken from the client. */
async function createOrder({ receipt, notes }) {
  return instance.orders.create({
    amount: config.amount, // paise
    currency: config.currency,
    receipt: receipt || `rcpt_${Date.now()}`,
    notes: notes || {},
    payment_capture: 1,
  });
}

/**
 * Verify the Razorpay checkout signature with HMAC-SHA256:
 *   expected = HMAC_SHA256(order_id + "|" + payment_id, KEY_SECRET)
 * Constant-time comparison to avoid timing attacks.
 */
function verifySignature({ orderId, paymentId, signature }) {
  if (!orderId || !paymentId || !signature) return false;
  const expected = crypto
    .createHmac("sha256", config.razorpay.keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(String(signature), "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Fetch a captured payment to read its real method + amount (best-effort). */
async function fetchPayment(paymentId) {
  try {
    return await instance.payments.fetch(paymentId);
  } catch (_) {
    return null;
  }
}

/**
 * Refund a captured payment via the gateway. `amountPaise` optional (full refund
 * if omitted). Throws on gateway error so the caller can surface it — this moves
 * real money, so it is only ever invoked from an authenticated admin action.
 */
async function refundPayment(paymentId, amountPaise) {
  const opts = amountPaise ? { amount: amountPaise } : {};
  return instance.payments.refund(paymentId, opts);
}

module.exports = { createOrder, verifySignature, fetchPayment, refundPayment };
