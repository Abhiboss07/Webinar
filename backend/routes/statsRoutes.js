"use strict";
const express = require("express");
const router = express.Router();

const statsController = require("../controllers/statsController");
const { requireAuth, requirePermission } = require("../middleware/auth");

router.get("/dashboard", requireAuth, requirePermission("dashboard", "view"), statsController.dashboard);

module.exports = router;
