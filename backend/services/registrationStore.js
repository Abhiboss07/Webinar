"use strict";
/**
 * Best-effort MongoDB mirror of registrations. Every function swallows its own
 * errors and logs — the caller's Sheets/payment flow must never fail because of
 * a DB hiccup. Keyed by regId (idempotent upserts).
 */
const Registration = require("../models/Registration");

function hostOf(url) {
  try { return new URL(url).hostname; } catch (_) { return ""; }
}

/** Upsert a pending (or updated) lead. `data` is the browser's form payload. */
async function upsertLead(data) {
  try {
    const regId = String(data.regId || "").trim();
    if (!regId) return;
    await Registration.updateOne(
      { regId },
      {
        $set: {
          fullName: data.fullName || "",
          mobile: data.mobile || "",
          email: data.email || "",
          profession: data.profession || "",
          city: data.city || "",
          experience: data.experience || "",
          mode: data.mode || "",
          workshop: data.workshop || "",
          source: data.source || "",
          sourceHost: hostOf(data.source || ""),
        },
        $setOnInsert: { paymentStatus: "Pending" },
      },
      { upsert: true }
    );
  } catch (err) {
    console.error("[registrationStore.upsertLead] non-fatal:", err.message);
  }
}

/** Flip a registration to Paid with payment details. */
async function markPaid(regId, payment) {
  try {
    const id = String(regId || "").trim();
    if (!id) return;
    await Registration.updateOne(
      { regId: id },
      {
        $set: {
          paymentStatus: "Paid",
          orderId: payment.orderId || "",
          paymentId: payment.paymentId || "",
          paymentMethod: payment.method || "",
          amount: Number(payment.amount) || 0,
          currency: payment.currency || "INR",
          transactionTime: payment.transactionTime ? new Date(payment.transactionTime) : new Date(),
        },
      },
      { upsert: true }
    );
  } catch (err) {
    console.error("[registrationStore.markPaid] non-fatal:", err.message);
  }
}

module.exports = { upsertLead, markPaid };
