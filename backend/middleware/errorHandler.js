"use strict";
/** 404 + centralized error handling. Keep responses small and non-leaky. */

function notFound(req, res) {
  res.status(404).json({ status: "error", message: "Not found" });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // CORS rejections surface here as errors — answer with 403, everything else 500.
  const isCors = err && /Not allowed by CORS/i.test(err.message || "");
  const code = isCors ? 403 : 500;
  console.error("[error]", err && err.message);
  if (!isCors) {
    try { require("../services/systemLogger").record("error", "error", (err && err.message) || "Server error", { path: req.originalUrl, method: req.method }); }
    catch (_) { /* logging must never break the response */ }
  }
  res.status(code).json({ status: "error", message: isCors ? "Origin not allowed" : "Server error" });
}

module.exports = { notFound, errorHandler };
