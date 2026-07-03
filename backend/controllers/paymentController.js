"use strict";
/**
 * Verifies the Razorpay signature server-side (HMAC-SHA256). The registration is
 * marked Paid ONLY when verification succeeds — frontend success is never trusted.
 */
const razorpayService = require("../services/razorpayService");
const sheetService = require("../services/sheetService");
const registrationStore = require("../services/registrationStore");
const { clean } = require("../utils/helpers");

async function verifyPayment(req, res) {
  const b = req.body || {};
  const regId = clean(b.regId);
  const orderId = clean(b.razorpay_order_id);
  const paymentId = clean(b.razorpay_payment_id);
  const signature = clean(b.razorpay_signature);
  // Presence is validated by middleware/validate.js (validateVerify).

  // 1) Cryptographic verification — the gate for everything below.
  const valid = await razorpayService.verifySignature({ orderId, paymentId, signature });
  if (!valid) {
    console.warn("[verify-payment] signature mismatch for", regId, orderId);
    return res.status(400).json({ status: "failed", message: "Signature verification failed" });
  }

  // 2) Enrich with the real method + amount (best-effort).
  let method = "Razorpay";
  let amountRupees = "";
  const info = await razorpayService.fetchPayment(paymentId);
  if (info) {
    if (info.method) method = info.method;
    if (info.amount != null) amountRupees = info.amount / 100;
  }

  // 3) Persist Paid status. If the sheet update fails, the payment IS captured,
  //    so we still report success (money is taken) but log loudly for reconciliation.
  try {
    await sheetService.markPaid(regId, {
      "Payment Status": "Paid",
      "Order ID": orderId,
      "Payment ID": paymentId,
      "Signature": signature,
      "Payment Method": method,
      "Amount": amountRupees,
      "Transaction Time": new Date().toISOString(),
    });
  } catch (err) {
    console.error("[verify-payment] sheet update failed (payment WAS verified):", err.message, { regId, paymentId });
  }

  // Mirror the Paid status into MongoDB (best-effort; never throws).
  await registrationStore.markPaid(regId, {
    orderId, paymentId, method, amount: amountRupees, currency: "INR",
    transactionTime: new Date().toISOString(),
  });

  return res.json({ status: "success", paymentId: paymentId, orderId: orderId, method: method, amount: amountRupees });
}

module.exports = { verifyPayment };
