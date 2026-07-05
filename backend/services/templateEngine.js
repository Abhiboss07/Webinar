"use strict";
/** Renders {{variable}} placeholders and builds a context from a registration. */

function render(str, ctx) {
  return String(str || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (ctx[k] != null ? String(ctx[k]) : ""));
}

const money = (n, cur = "INR") => (n ? `${cur === "INR" ? "₹" : cur + " "}${Number(n).toLocaleString("en-IN")}` : "");

/** Build the variable context. `extra` (workshop facts, links) overrides. */
function buildContext(reg = {}, extra = {}) {
  return {
    name: reg.fullName || reg.name || "there",
    email: reg.email || "",
    mobile: reg.mobile || "",
    profession: reg.profession || "",
    city: reg.city || "",
    workshop: reg.workshop || extra.workshop || "",
    date: extra.date || "",
    time: extra.time || "",
    venue: extra.venue || "",
    amount: money(reg.amount, reg.currency),
    payment_status: reg.paymentStatus || "",
    certificate_link: extra.certificate_link || "",
    regId: reg.regId || "",
    ...extra,
  };
}

/** List variables referenced in a string (for the editor). */
function variablesIn(str) {
  const set = new Set();
  String(str || "").replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => set.add(k));
  return [...set];
}

module.exports = { render, buildContext, variablesIn };
