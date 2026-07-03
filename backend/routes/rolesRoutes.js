"use strict";
const express = require("express");
const router = express.Router();

const c = require("../controllers/rolesController");
const { requireAuth, requirePermission } = require("../middleware/auth");

router.use(requireAuth);
router.get("/", requirePermission("roles", "view"), c.list);
router.post("/", requirePermission("roles", "create"), c.create);
router.patch("/:id", requirePermission("roles", "edit"), c.update);
router.delete("/:id", requirePermission("roles", "delete"), c.remove);

module.exports = router;
