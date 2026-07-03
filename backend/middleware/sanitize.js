"use strict";
/**
 * Lightweight NoSQL-injection guard: strip keys beginning with "$" (and any
 * containing "$") from req.query / req.params, where user input feeds Mongo
 * filters. Deliberately does NOT touch req.body — bodies legitimately carry
 * arbitrary content (settings blobs, trigger keys like "payment.success").
 */
function strip(obj) {
  if (!obj || typeof obj !== "object") return;
  for (const key of Object.keys(obj)) {
    if (key.startsWith("$") || key.includes("$")) { delete obj[key]; continue; }
    if (obj[key] && typeof obj[key] === "object") strip(obj[key]);
  }
}

module.exports = function sanitize(req, res, next) {
  strip(req.query);
  strip(req.params);
  next();
};
