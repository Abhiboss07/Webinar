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
  res.status(code).json({ status: "error", message: isCors ? "Origin not allowed" : "Server error" });
}

module.exports = { notFound, errorHandler };
