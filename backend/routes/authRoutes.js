"use strict";
const express = require("express");
const router = express.Router();

const c = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");
const { loginLimiter } = require("../middleware/rateLimit");

router.post("/login", loginLimiter, c.login);
router.post("/refresh", c.refresh);
router.post("/logout", c.logout);
router.get("/me", requireAuth, c.me);
router.post("/change-password", requireAuth, c.changePassword);
router.post("/forgot-password", loginLimiter, c.forgotPassword);
router.post("/reset-password", loginLimiter, c.resetPassword);

module.exports = router;
