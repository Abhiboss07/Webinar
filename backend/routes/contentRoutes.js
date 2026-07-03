"use strict";
const express = require("express");
const router = express.Router();

const c = require("../controllers/siteConfigController");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { writeLimiter, publicReadLimiter } = require("../middleware/rateLimit");

const view = [requireAuth, requirePermission("homepage_cms", "view")];
const edit = [requireAuth, requirePermission("homepage_cms", "edit")];
const publish = [requireAuth, requirePermission("homepage_cms", "publish")];

// Public read — the live site fetches this on load (?preview=1 → draft).
router.get("/site-config", publicReadLimiter, c.getPublic);

// Admin draft workflow.
router.get("/site-config/draft", ...view, c.getDraft);
router.put("/site-config", ...edit, writeLimiter, c.saveDraft);
router.post("/site-config/publish", ...publish, c.publish);
router.post("/site-config/discard", ...edit, c.discardDraft);
router.get("/site-config/history", ...view, c.history);
router.post("/site-config/revert", ...publish, c.revert);

module.exports = router;
