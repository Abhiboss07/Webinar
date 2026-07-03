"use strict";
const express = require("express");
const router = express.Router();

const c = require("../controllers/analyticsController");
const { requireAuth, requirePermission } = require("../middleware/auth");

const view = requirePermission("analytics", "view");

router.use(requireAuth);
router.get("/executive", view, c.executive);
router.get("/revenue", view, c.revenue);
router.get("/registrations", view, c.registrations);
router.get("/attendance", view, c.attendance);
router.get("/certificates", view, c.certificates);
router.get("/communication", view, c.communication);
router.get("/workshops", view, c.workshops);
router.get("/export", requirePermission("analytics", "export"), c.exportReport);

module.exports = router;
