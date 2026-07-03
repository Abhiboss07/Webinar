"use strict";
/**
 * Auth + RBAC middleware. requireAuth verifies the access JWT and loads the
 * user's CURRENT role/permissions from the DB (short in-memory cache), so role
 * changes and deactivations take effect immediately. Super Admin bypasses checks.
 */
const jwt = require("jsonwebtoken");
const config = require("../config");
const User = require("../models/User");
const Role = require("../models/Role");
const { can } = require("../services/rbac");

// Small role cache so we don't hit Mongo for the matrix on every request.
const roleCache = new Map(); // key → { role, ts }
const ROLE_TTL = 8000;
async function getRole(key) {
  const hit = roleCache.get(key);
  if (hit && Date.now() - hit.ts < ROLE_TTL) return hit.role;
  const role = await Role.findOne({ key }).lean();
  roleCache.set(key, { role, ts: Date.now() });
  return role;
}
function clearRoleCache() { roleCache.clear(); } // called when roles are edited

function getToken(req) {
  const h = req.headers.authorization || "";
  return h.startsWith("Bearer ") ? h.slice(7).trim() : null;
}

async function requireAuth(req, res, next) {
  const token = getToken(req);
  if (!token) return res.status(401).json({ status: "error", message: "Authentication required" });
  let payload;
  try { payload = jwt.verify(token, config.jwt.secret); }
  catch (_) { return res.status(401).json({ status: "error", message: "Session expired or invalid. Please log in again." }); }
  if (payload.typ && payload.typ !== "access") return res.status(401).json({ status: "error", message: "Invalid token type" });

  const user = await User.findById(payload.sub).select("email name role active").lean();
  if (!user) return res.status(401).json({ status: "error", message: "Account not found" });
  if (!user.active) return res.status(403).json({ status: "error", message: "Your account is deactivated" });

  const roleObj = await getRole(user.role);
  req.user = {
    id: String(user._id), email: user.email, name: user.name, role: user.role,
    isSuperAdmin: !!(roleObj && roleObj.isSuperAdmin), roleObj: roleObj || null,
    can: (resource, action) => can(roleObj, resource, action),
  };
  return next();
}

/** Require a specific permission (resource, action). Super Admin always passes. */
function requirePermission(resource, action) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ status: "error", message: "Authentication required" });
    if (req.user.can(resource, action)) return next();
    return res.status(403).json({ status: "error", message: `You don't have permission to ${action} ${resource.replace(/_/g, " ")}` });
  };
}

/** Backward-compatible role gate (accepts role keys; Super Admin always passes). */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ status: "error", message: "Authentication required" });
    if (req.user.isSuperAdmin || roles.includes(req.user.role)) return next();
    return res.status(403).json({ status: "error", message: "You do not have permission to do that" });
  };
}

module.exports = { requireAuth, requirePermission, requireRole, clearRoleCache };
