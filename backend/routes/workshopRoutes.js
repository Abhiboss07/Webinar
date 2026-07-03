"use strict";
const express = require("express");
const router = express.Router();

const c = require("../controllers/workshopController");
const { requireAuth, requireRole } = require("../middleware/auth");
const { writeLimiter } = require("../middleware/rateLimit");

const editor = [requireAuth, requireRole("admin", "editor")];

router.get("/", ...editor, c.list);
router.post("/", ...editor, writeLimiter, c.create);
router.get("/:id", ...editor, c.getOne);
router.put("/:id", ...editor, writeLimiter, c.update);
router.delete("/:id", ...editor, c.remove);
router.post("/:id/duplicate", ...editor, c.duplicate);
router.post("/:id/activate", ...editor, c.activate);
router.post("/:id/status", ...editor, c.setStatus);

module.exports = router;
