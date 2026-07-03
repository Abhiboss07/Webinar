"use strict";
const express = require("express");
const router = express.Router();

const c = require("../controllers/usersController");
const { requireAuth, requirePermission } = require("../middleware/auth");

router.use(requireAuth);
router.get("/", requirePermission("users", "view"), c.list);
router.get("/:id", requirePermission("users", "view"), c.getOne);
router.post("/", requirePermission("users", "create"), c.invite);
router.patch("/:id", requirePermission("users", "edit"), c.update);
router.post("/:id/reset-password", requirePermission("users", "edit"), c.resetPassword);
router.delete("/:id/sessions/:sessionId", requirePermission("users", "edit"), c.revokeSession);
router.delete("/:id", requirePermission("users", "delete"), c.remove);

module.exports = router;
