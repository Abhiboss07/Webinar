"use strict";
/**
 * User — admin accounts for the CMS. Passwords are hashed with bcrypt and never
 * returned by the API (passwordHash has select:false). The first user is created
 * from env by scripts/seedAdmin.js.
 */
const bcrypt = require("bcryptjs");
const { mongoose } = require("../db/connect");

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    name: { type: String, default: "Administrator" },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["admin", "editor"], default: "admin" },
    active: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true }
);

/** Set (and hash) a plaintext password. */
userSchema.methods.setPassword = async function (plain) {
  const salt = await bcrypt.genSalt(12);
  this.passwordHash = await bcrypt.hash(String(plain), salt);
};

/** Compare a plaintext password against the stored hash. */
userSchema.methods.verifyPassword = function (plain) {
  return bcrypt.compare(String(plain), this.passwordHash || "");
};

/** Public JSON (never leak the hash). */
userSchema.methods.toPublic = function () {
  return { id: this._id, email: this.email, name: this.name, role: this.role, active: this.active };
};

module.exports = mongoose.model("User", userSchema);
