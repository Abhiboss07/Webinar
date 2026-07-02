"use strict";
/**
 * JWT auth middleware for protected admin/CMS routes. Reads a Bearer token from
 * the Authorization header (the React admin sends it) and attaches req.user.
 */
const jwt = require("jsonwebtoken");
const config = require("../config");

function getToken(req) {
  const h = req.headers.authorization || "";
  if (h.startsWith("Bearer ")) return h.slice(7).trim();
  return null;
}

/** Require a valid admin JWT. 401 otherwise. */
function requireAuth(req, res, next) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ status: "error", message: "Authentication required" });
  try {
    const payload = jwt.verify(token, config.jwt.secret);
    req.user = { id: payload.sub, email: payload.email, role: payload.role };
    return next();
  } catch (_) {
    return res.status(401).json({ status: "error", message: "Session expired or invalid. Please log in again." });
  }
}

/** Require one of the given roles (use after requireAuth). */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ status: "error", message: "You do not have permission to do that" });
    }
    return next();
  };
}

module.exports = { requireAuth, requireRole };
