"use strict";
/** Rate limiters. Login is strict (brute-force defense); the content write API
 *  is generous (autosave) but still bounded; public reads are lightly capped. */
const rateLimit = require("express-rate-limit");

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,                  // 20 login attempts / IP / window
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: "error", message: "Too many login attempts. Please try again in a few minutes." },
});

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,                 // room for autosave bursts
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: "error", message: "Too many requests. Slow down a moment." },
});

const publicReadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { loginLimiter, writeLimiter, publicReadLimiter };
