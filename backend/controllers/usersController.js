"use strict";
/** User management (RBAC). Guards protect the last active Super Admin and self. */
const User = require("../models/User");
const Role = require("../models/Role");
const Session = require("../models/Session");
const config = require("../config");
const audit = require("../services/audit");
const { clean, isEmail } = require("../utils/helpers");
const { randomToken, sha256, validatePassword } = require("../utils/password");

async function superAdminCount(excludeId) {
  return User.countDocuments({ role: "super_admin", active: true, ...(excludeId ? { _id: { $ne: excludeId } } : {}) });
}
async function roleExists(key) { return Role.exists({ key }); }

async function list(req, res) {
  try {
    const [users, roles] = await Promise.all([
      User.find({}).sort({ createdAt: -1 }),
      Role.find({}).select("key name isSuperAdmin").sort({ isSuperAdmin: -1, name: 1 }).lean(),
    ]);
    // Assignable roles are surfaced here so user-managers don't need roles.view.
    return res.json({ status: "success", users: users.map((u) => u.toPublic()), roles: roles.map((r) => ({ key: r.key, name: r.name })) });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Could not list users" });
  }
}

async function getOne(req, res) {
  try {
    const u = await User.findById(req.params.id);
    if (!u) return res.status(404).json({ status: "error", message: "Not found" });
    const sessions = await Session.find({ userId: u._id, revoked: false, expiresAt: { $gt: new Date() } }).sort({ lastUsedAt: -1 }).lean();
    return res.json({ status: "success", user: u.toPublic(), sessions: sessions.map((s) => ({ id: s._id, ip: s.ip, userAgent: s.userAgent, lastUsedAt: s.lastUsedAt, createdAt: s.createdAt })) });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Could not load user" });
  }
}

/** Invite a user: creates the account with a one-time token (email delivery TBD). */
async function invite(req, res) {
  try {
    const b = req.body || {};
    const email = clean(b.email).toLowerCase();
    if (!isEmail(email)) return res.status(400).json({ status: "error", message: "A valid email is required" });
    if (await User.exists({ email })) return res.status(409).json({ status: "error", message: "A user with that email already exists" });
    const role = clean(b.role) || "viewer";
    if (!(await roleExists(role))) return res.status(400).json({ status: "error", message: "Unknown role" });

    const token = randomToken();
    const hashed = sha256(token);
    const user = new User({
      email, name: clean(b.name) || email.split("@")[0], role, active: true,
      inviteToken: hashed, inviteExpires: new Date(Date.now() + 7 * 86400000),
      // Also set the reset token so the invitee can set their first password via
      // the standard reset-password endpoint with this same one-time token.
      resetToken: hashed, resetExpires: new Date(Date.now() + 7 * 86400000),
      mustResetPassword: true, invitedBy: req.user.id,
    });
    await user.setPassword(randomToken()); // unusable random password until they set one
    await user.save();
    await audit.record(req, "user.create", { resource: "users", targetId: user._id, newValue: { email, role } });
    const resp = { status: "success", user: user.toPublic() };
    if (!config.isProd) resp.inviteToken = token; // surfaced until SMTP is wired
    return res.status(201).json(resp);
  } catch (err) {
    console.error("[users/invite]", err.message);
    return res.status(500).json({ status: "error", message: "Could not invite user" });
  }
}

async function update(req, res) {
  try {
    const u = await User.findById(req.params.id);
    if (!u) return res.status(404).json({ status: "error", message: "Not found" });
    const b = req.body || {};
    const before = { name: u.name, role: u.role, active: u.active };

    if (b.name != null) u.name = clean(b.name);
    if (b.role != null && b.role !== u.role) {
      if (!(await roleExists(b.role))) return res.status(400).json({ status: "error", message: "Unknown role" });
      if (u.role === "super_admin" && b.role !== "super_admin" && (await superAdminCount(u._id)) === 0)
        return res.status(400).json({ status: "error", message: "Cannot remove the last Super Admin" });
      u.role = b.role;
    }
    if (typeof b.active === "boolean" && b.active !== u.active) {
      if (!b.active && String(u._id) === req.user.id) return res.status(400).json({ status: "error", message: "You cannot deactivate your own account" });
      if (!b.active && u.role === "super_admin" && (await superAdminCount(u._id)) === 0) return res.status(400).json({ status: "error", message: "Cannot deactivate the last Super Admin" });
      u.active = b.active;
      if (!b.active) await Session.updateMany({ userId: u._id }, { $set: { revoked: true } }); // force logout
    }
    await u.save();
    await audit.record(req, "user.update", { resource: "users", targetId: u._id, oldValue: before, newValue: { name: u.name, role: u.role, active: u.active } });
    return res.json({ status: "success", user: u.toPublic() });
  } catch (err) {
    console.error("[users/update]", err.message);
    return res.status(500).json({ status: "error", message: "Could not update user" });
  }
}

/** Admin-initiated password reset → one-time token + force change on next login. */
async function resetPassword(req, res) {
  try {
    const u = await User.findById(req.params.id);
    if (!u) return res.status(404).json({ status: "error", message: "Not found" });
    const token = randomToken();
    u.resetToken = sha256(token); u.resetExpires = new Date(Date.now() + 86400000); u.mustResetPassword = true;
    await u.save();
    await audit.record(req, "user.reset_password", { resource: "users", targetId: u._id });
    const resp = { status: "success" };
    if (!config.isProd) resp.resetToken = token;
    return res.json(resp);
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Could not reset password" });
  }
}

async function remove(req, res) {
  try {
    const u = await User.findById(req.params.id);
    if (!u) return res.status(404).json({ status: "error", message: "Not found" });
    if (String(u._id) === req.user.id) return res.status(400).json({ status: "error", message: "You cannot delete your own account" });
    if (u.role === "super_admin" && (await superAdminCount(u._id)) === 0) return res.status(400).json({ status: "error", message: "Cannot delete the last Super Admin" });
    await Session.deleteMany({ userId: u._id });
    await u.deleteOne();
    await audit.record(req, "user.delete", { resource: "users", targetId: u._id, oldValue: { email: u.email, role: u.role } });
    return res.json({ status: "success" });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Could not delete user" });
  }
}

async function revokeSession(req, res) {
  try {
    await Session.updateOne({ _id: req.params.sessionId, userId: req.params.id }, { $set: { revoked: true } });
    await audit.record(req, "session.revoke", { resource: "users", targetId: req.params.id });
    return res.json({ status: "success" });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Could not revoke session" });
  }
}

module.exports = { list, getOne, invite, update, resetPassword, remove, revokeSession };
