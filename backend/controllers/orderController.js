"use strict";
/**
 * Creates a Razorpay order. The amount is taken from server config — never from
 * the request body — so the price can't be tampered with from the browser.
 */
const config = require("../config");
const razorpayService = require("../services/razorpayService");
const { clean, receiptFor } = require("../utils/helpers");

async function createOrder(req, res) {
  try {
    const regId = clean(req.body && req.body.regId); // presence validated by middleware

    const order = await razorpayService.createOrder({
      receipt: receiptFor(regId),
      notes: { regId: regId },
    });

    return res.json({
      status: "success",
      orderId: order.id,
      amount: order.amount,        // paise
      currency: order.currency,
      keyId: config.razorpay.keyId, // public key id for Checkout
    });
  } catch (err) {
    console.error("[create-order] error:", err && (err.error || err.message || err));
    return res.status(502).json({ status: "error", message: "Could not create payment order" });
  }
}

module.exports = { createOrder };
