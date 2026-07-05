"use strict";
const express = require("express");
const router = express.Router();

const c = require("../controllers/auditController");
const { requireAuth, requirePermission } = require("../middleware/auth");

router.get("/", requireAuth, requirePermission("users", "view"), c.list);

module.exports = router;
