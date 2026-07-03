"use strict";
const express = require("express");
const router = express.Router();

const c = require("../controllers/settingsController");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { publicReadLimiter } = require("../middleware/rateLimit");

const view = [requireAuth, requirePermission("settings", "view")];
const edit = [requireAuth, requirePermission("settings", "edit")];

// Public, non-secret settings for the frontend.
router.get("/public", publicReadLimiter, c.getPublicSettings);

router.get("/", ...view, c.getAdmin);
router.get("/diagnostics", ...view, c.diagnostics);
router.get("/history", ...view, c.history);
router.get("/export", ...edit, c.exportSettings);
router.patch("/", ...edit, c.update);
router.post("/test", ...edit, c.testConnection);
router.post("/test-email", ...edit, c.sendTestEmail);
router.post("/import", ...edit, c.importSettings);
router.post("/restore-defaults", ...edit, c.restoreDefaults);
router.post("/revert", ...edit, c.revert);

module.exports = router;
