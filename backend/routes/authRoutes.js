"use strict";
const express = require("express");
const router = express.Router();

const authController = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");
const { loginLimiter } = require("../middleware/rateLimit");

router.post("/login", loginLimiter, authController.login);
router.post("/logout", authController.logout);
router.get("/me", requireAuth, authController.me);

module.exports = router;
