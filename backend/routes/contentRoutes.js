"use strict";
const express = require("express");
const router = express.Router();

const siteConfigController = require("../controllers/siteConfigController");
const { requireAuth, requireRole } = require("../middleware/auth");
const { writeLimiter, publicReadLimiter } = require("../middleware/rateLimit");

// Public read — the live site fetches this on load.
router.get("/site-config", publicReadLimiter, siteConfigController.getPublic);

// Admin write — full-document save (autosave-friendly).
router.put("/site-config", requireAuth, requireRole("admin", "editor"), writeLimiter, siteConfigController.update);

module.exports = router;
