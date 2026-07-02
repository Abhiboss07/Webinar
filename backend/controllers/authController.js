"use strict";
/**
 * Admin authentication — email + password → JWT. Passwords are verified against
 * bcrypt hashes in the DB. Logout is client-side (drop the token); we expose a
 * no-op endpoint for symmetry and a /me endpoint to restore a session.
 */
const jwt = require("jsonwebtoken");
const config = require("../config");
const User = require("../models/User");
const { clean, isEmail } = require("../utils/helpers");

function signToken(user) {
  return jwt.sign(
    { sub: String(user._id), email: user.email, role: user.role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

async function login(req, res) {
  try {
    const email = clean((req.body || {}).email).toLowerCase();
    const password = clean((req.body || {}).password);
    if (!isEmail(email) || !password) {
      return res.status(400).json({ status: "error", message: "Email and password are required" });
    }

    // Fetch WITH the hash (select:false by default). Constant-ish response to
    // avoid leaking which part failed.
    const user = await User.findOne({ email }).select("+passwordHash");
    const ok = user && user.active && (await user.verifyPassword(password));
    if (!ok) return res.status(401).json({ status: "error", message: "Invalid email or password" });

    user.lastLoginAt = new Date();
    await user.save();

    const token = signToken(user);
    return res.json({ status: "success", token, user: user.toPublic() });
  } catch (err) {
    console.error("[auth/login] error:", err.message);
    return res.status(500).json({ status: "error", message: "Login failed" });
  }
}

async function me(req, res) {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !user.active) return res.status(401).json({ status: "error", message: "Account not found" });
    return res.json({ status: "success", user: user.toPublic() });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Could not load account" });
  }
}

function logout(_req, res) {
  // Stateless JWT: the client discards the token. Endpoint exists for symmetry.
  return res.json({ status: "success" });
}

module.exports = { login, me, logout };
