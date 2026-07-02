"use strict";
const express = require("express");
const router = express.Router();

const statsController = require("../controllers/statsController");
const { requireAuth } = require("../middleware/auth");

// Admin dashboard analytics.
router.get("/dashboard", requireAuth, statsController.dashboard);

module.exports = router;
