"use strict";
const express = require("express");
const router = express.Router();

const c = require("../controllers/workshopController");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { writeLimiter } = require("../middleware/rateLimit");

const view = requirePermission("workshops", "view");
const edit = requirePermission("workshops", "edit");
const publish = requirePermission("workshops", "publish");

router.use(requireAuth);
router.get("/", view, c.list);
router.post("/", requirePermission("workshops", "create"), writeLimiter, c.create);
router.get("/:id", view, c.getOne);
router.put("/:id", edit, writeLimiter, c.update);
router.delete("/:id", requirePermission("workshops", "delete"), c.remove);
router.post("/:id/duplicate", requirePermission("workshops", "create"), c.duplicate);
router.post("/:id/activate", publish, c.activate);
router.post("/:id/status", publish, c.setStatus);

module.exports = router;
