"use strict";
/**
 * Razorpay service — order creation + signature verification + refunds. Keys come
 * from the settings provider (admin-managed, test/live mode) with env fallback,
 * so the Key Secret still lives only on the server and is never sent to the client.
 */
const crypto = require("crypto");
const Razorpay = require("razorpay");
const config = require("../config");
const provider = require("./settingsProvider");

let cached = { key: "", instance: null };
async function getInstance() {
  const { keyId, keySecret } = await provider.razorpay();
  const k = `${keyId}:${keySecret}`;
  if (cached.key !== k) cached = { key: k, instance: new Razorpay({ key_id: keyId, key_secret: keySecret }) };
  return cached.instance;
}

/** Create an order. Amount is server-owned (config), not taken from the client. */
async function createOrder({ receipt, notes }) {
  const instance = await getInstance();
  return instance.orders.create({
    amount: config.amount, currency: config.currency,
    receipt: receipt || `rcpt_${Date.now()}`, notes: notes || {}, payment_capture: 1,
  });
}

/** Verify the checkout signature (HMAC-SHA256) with a constant-time compare. */
async function verifySignature({ orderId, paymentId, signature }) {
  if (!orderId || !paymentId || !signature) return false;
  const { keySecret } = await provider.razorpay();
  // Never trust the secret's shape: a corrupted settings value must fail the
  // verification, not crash the process inside createHmac.
  if (!keySecret || typeof keySecret !== "string") {
    console.error("[razorpay] key secret is missing or not a string — rejecting verification");
    return false;
  }
  const expected = crypto.createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(String(signature), "utf8");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Fetch a captured payment to read its real method + amount (best-effort). */
async function fetchPayment(paymentId) {
  try { const instance = await getInstance(); return await instance.payments.fetch(paymentId); }
  catch (_) { return null; }
}

/** Refund a captured payment (admin action only). Throws on gateway error. */
async function refundPayment(paymentId, amountPaise) {
  const instance = await getInstance();
  return instance.payments.refund(paymentId, amountPaise ? { amount: amountPaise } : {});
}

module.exports = { createOrder, verifySignature, fetchPayment, refundPayment, invalidate: () => (cached = { key: "", instance: null }) };
