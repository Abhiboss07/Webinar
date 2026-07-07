"use strict";
/** 404 + centralized error handling. Keep responses small and non-leaky. */

function notFound(req, res) {
  res.status(404).json({ status: "error", message: "Not found" });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Client errors keep their own status: CORS rejections → 403; body-parser
  // failures (malformed JSON, oversized payload) carry a 4xx on err.status and
  // must not be reported as server errors.
  const isCors = err && /Not allowed by CORS/i.test(err.message || "");
  const clientCode = Number((err && (err.status || err.statusCode)) || 0);
  const isClient = clientCode >= 400 && clientCode < 500;
  if (isClient && !isCors) {
    return res.status(clientCode).json({ status: "error", message: clientCode === 400 ? "Invalid request body" : "Request rejected" });
  }
  const code = isCors ? 403 : 500;
  console.error("[error]", err && err.message);
  if (!isCors) {
    try { require("../services/systemLogger").record("error", "error", (err && err.message) || "Server error", { path: req.originalUrl, method: req.method }); }
    catch (_) { /* logging must never break the response */ }
  }
  res.status(code).json({ status: "error", message: isCors ? "Origin not allowed" : "Server error" });
}

module.exports = { notFound, errorHandler };
