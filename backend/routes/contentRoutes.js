"use strict";
const express = require("express");
const router = express.Router();

const c = require("../controllers/siteConfigController");
const { requireAuth, requireRole } = require("../middleware/auth");
const { writeLimiter, publicReadLimiter } = require("../middleware/rateLimit");

const editor = [requireAuth, requireRole("admin", "editor")];

// Public read — the live site fetches this on load (?preview=1 → draft).
router.get("/site-config", publicReadLimiter, c.getPublic);

// Admin draft workflow.
router.get("/site-config/draft", ...editor, c.getDraft);
router.put("/site-config", ...editor, writeLimiter, c.saveDraft);       // autosave → draft
router.post("/site-config/publish", ...editor, c.publish);
router.post("/site-config/discard", ...editor, c.discardDraft);
router.get("/site-config/history", ...editor, c.history);
router.post("/site-config/revert", ...editor, c.revert);

module.exports = router;
