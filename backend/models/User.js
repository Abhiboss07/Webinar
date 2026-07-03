"use strict";
/**
 * User — admin accounts for the CMS. Passwords are hashed with bcrypt and never
 * returned by the API (passwordHash has select:false). `role` is a Role.key
 * (RBAC, Module 2.7). The first user is created by scripts/seedAdmin.js.
 */
const bcrypt = require("bcryptjs");
const { mongoose } = require("../db/connect");

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, default: "Administrator" },
    passwordHash: { type: String, select: false, default: "" },
    role: { type: String, default: "viewer", index: true }, // → Role.key
    active: { type: Boolean, default: true },
    avatar: { type: String, default: "" },

    // Invitation / password reset (delivery via email is wired in a later module;
    // tokens are generated here so the flow works end-to-end).
    inviteToken: { type: String, select: false, default: "" },
    inviteExpires: { type: Date, default: null },
    resetToken: { type: String, select: false, default: "" },
    resetExpires: { type: Date, default: null },
    mustResetPassword: { type: Boolean, default: false },

    // Brute-force protection.
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date, default: null },

    // 2FA-ready (not enforced yet).
    twoFactorEnabled: { type: Boolean, default: false },

    lastLoginAt: { type: Date, default: null },
    lastLoginIp: { type: String, default: "" },
    passwordChangedAt: { type: Date, default: null },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

userSchema.methods.setPassword = async function (plain) {
  const salt = await bcrypt.genSalt(12);
  this.passwordHash = await bcrypt.hash(String(plain), salt);
  this.passwordChangedAt = new Date();
};
userSchema.methods.verifyPassword = function (plain) {
  return this.passwordHash ? bcrypt.compare(String(plain), this.passwordHash) : Promise.resolve(false);
};
userSchema.methods.isLocked = function () {
  return !!(this.lockUntil && this.lockUntil > new Date());
};
userSchema.methods.toPublic = function () {
  return {
    id: this._id, email: this.email, name: this.name, role: this.role, active: this.active,
    avatar: this.avatar, twoFactorEnabled: this.twoFactorEnabled, mustResetPassword: this.mustResetPassword,
    lastLoginAt: this.lastLoginAt, lastLoginIp: this.lastLoginIp, locked: this.isLocked(), createdAt: this.createdAt,
  };
};

module.exports = mongoose.model("User", userSchema);
