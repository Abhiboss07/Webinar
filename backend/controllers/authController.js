"use strict";
/**
 * Authentication — login (with brute-force lock + audit), refresh tokens +
 * sessions, logout, password change / forgot / reset, and /me (returns the
 * user's effective permissions so the admin UI can gate itself).
 */
const jwt = require("jsonwebtoken");
const config = require("../config");
const User = require("../models/User");
const Role = require("../models/Role");
const Session = require("../models/Session");
const audit = require("../services/audit");
const { validatePassword, randomToken, sha256 } = require("../utils/password");
const { clean, isEmail } = require("../utils/helpers");

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

function signAccess(user) {
  return jwt.sign({ sub: String(user._id), email: user.email, typ: "access" }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
}

async function createSession(userId, req, rememberMe) {
  const token = randomToken();
  const days = rememberMe ? 30 : 7;
  await Session.create({
    userId, tokenHash: sha256(token), userAgent: String(req.headers["user-agent"] || "").slice(0, 300),
    ip: audit.ipOf(req), expiresAt: new Date(Date.now() + days * 86400000),
  });
  return token;
}

async function permissionsFor(roleKey) {
  const role = await Role.findOne({ key: roleKey }).lean();
  return { permissions: (role && role.permissions) || {}, isSuperAdmin: !!(role && role.isSuperAdmin), roleName: role ? role.name : roleKey };
}

async function login(req, res) {
  try {
    const email = clean((req.body || {}).email).toLowerCase();
    const password = String((req.body || {}).password || "");
    const rememberMe = !!(req.body || {}).rememberMe;
    if (!isEmail(email) || !password) return res.status(400).json({ status: "error", message: "Email and password are required" });

    const user = await User.findOne({ email }).select("+passwordHash email name role active failedLoginAttempts lockUntil mustResetPassword");
    if (!user || !user.active) {
      await audit.record(req, "login.failed", { email, newValue: { reason: "no-account-or-inactive" } });
      return res.status(401).json({ status: "error", message: "Invalid email or password" });
    }
    if (user.isLocked()) {
      await audit.record(req, "login.locked", { email });
      return res.status(423).json({ status: "error", message: "Account temporarily locked after too many attempts. Try again later." });
    }

    const okPw = await user.verifyPassword(password);
    if (!okPw) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= MAX_FAILS) { user.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60000); user.failedLoginAttempts = 0; }
      await user.save();
      await audit.record(req, "login.failed", { email, newValue: { attempts: user.failedLoginAttempts } });
      return res.status(401).json({ status: "error", message: "Invalid email or password" });
    }

    user.failedLoginAttempts = 0; user.lockUntil = null;
    user.lastLoginAt = new Date(); user.lastLoginIp = audit.ipOf(req);
    await user.save();

    const token = signAccess(user);
    const refreshToken = await createSession(user._id, req, rememberMe);
    req.user = { id: String(user._id), email: user.email };
    await audit.record(req, "login", { newValue: { rememberMe } });
    const perms = await permissionsFor(user.role);
    return res.json({ status: "success", token, refreshToken, user: user.toPublic(), ...perms });
  } catch (err) {
    console.error("[auth/login]", err.message);
    return res.status(500).json({ status: "error", message: "Login failed" });
  }
}

async function refresh(req, res) {
  try {
    const rt = clean((req.body || {}).refreshToken);
    if (!rt) return res.status(400).json({ status: "error", message: "Missing refresh token" });
    const session = await Session.findOne({ tokenHash: sha256(rt), revoked: false });
    if (!session || session.expiresAt < new Date()) return res.status(401).json({ status: "error", message: "Session expired — please log in again" });
    const user = await User.findById(session.userId);
    if (!user || !user.active) return res.status(401).json({ status: "error", message: "Account unavailable" });
    session.lastUsedAt = new Date();
    await session.save();
    return res.json({ status: "success", token: signAccess(user) });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Could not refresh session" });
  }
}

async function logout(req, res) {
  try {
    const rt = clean((req.body || {}).refreshToken);
    if (rt) await Session.updateOne({ tokenHash: sha256(rt) }, { $set: { revoked: true } });
    if (req.user) await audit.record(req, "logout", {});
    return res.json({ status: "success" });
  } catch (err) {
    return res.json({ status: "success" }); // logout is best-effort
  }
}

async function me(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.active) return res.status(401).json({ status: "error", message: "Account not found" });
    const perms = await permissionsFor(user.role);
    return res.json({ status: "success", user: user.toPublic(), ...perms });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Could not load account" });
  }
}

async function changePassword(req, res) {
  try {
    const b = req.body || {};
    const user = await User.findById(req.user.id).select("+passwordHash");
    if (!user) return res.status(404).json({ status: "error", message: "Not found" });
    if (!(await user.verifyPassword(b.currentPassword || ""))) return res.status(400).json({ status: "error", message: "Current password is incorrect" });
    const err = validatePassword(b.newPassword);
    if (err) return res.status(400).json({ status: "error", message: err });
    await user.setPassword(b.newPassword);
    user.mustResetPassword = false;
    await user.save();
    await audit.record(req, "password.change", { resource: "users", targetId: user._id });
    return res.json({ status: "success" });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Could not change password" });
  }
}

async function forgotPassword(req, res) {
  try {
    const email = clean((req.body || {}).email).toLowerCase();
    const user = await User.findOne({ email });
    // Always respond success (don't reveal whether the email exists).
    const resp = { status: "success", message: "If that email exists, a reset link has been generated." };
    if (!user) return res.json(resp);
    const token = randomToken();
    user.resetToken = sha256(token); user.resetExpires = new Date(Date.now() + 3600000);
    await user.save();
    await audit.record({ ...req, user: { id: user._id, email } }, "password.forgot", { targetId: user._id });
    // No SMTP wired yet → surface the token in non-production so the flow is usable.
    if (!config.isProd) resp.devToken = token;
    return res.json(resp);
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Could not start reset" });
  }
}

async function resetPassword(req, res) {
  try {
    const b = req.body || {};
    const token = clean(b.token);
    const err = validatePassword(b.newPassword);
    if (err) return res.status(400).json({ status: "error", message: err });
    const user = await User.findOne({ resetToken: sha256(token), resetExpires: { $gt: new Date() } }).select("+passwordHash +resetToken");
    if (!user) return res.status(400).json({ status: "error", message: "Invalid or expired reset token" });
    await user.setPassword(b.newPassword);
    user.resetToken = ""; user.resetExpires = null; user.mustResetPassword = false;
    user.failedLoginAttempts = 0; user.lockUntil = null;
    await user.save();
    await Session.updateMany({ userId: user._id }, { $set: { revoked: true } }); // log out everywhere
    await audit.record({ ...req, user: { id: user._id, email: user.email } }, "password.reset", { targetId: user._id });
    return res.json({ status: "success" });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Could not reset password" });
  }
}

module.exports = { login, refresh, logout, me, changePassword, forgotPassword, resetPassword };
