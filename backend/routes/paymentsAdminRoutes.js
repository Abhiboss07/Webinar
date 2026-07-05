"use strict";
const express = require("express");
const router = express.Router();

const c = require("../controllers/paymentsController");
const { requireAuth, requirePermission } = require("../middleware/auth");

const view = requirePermission("payments", "view");

router.use(requireAuth);
router.get("/", view, c.list);
router.get("/stats", view, c.stats);
router.get("/analytics", view, c.analytics);
router.get("/export", requirePermission("payments", "export"), c.exportRows);
router.get("/:id", view, c.getOne);
router.get("/:id/receipt", view, c.receipt);
router.get("/:id/invoice", view, c.invoice);
router.post("/:id/verify", requirePermission("payments", "edit"), c.retryVerify);
router.post("/:id/status", requirePermission("payments", "edit"), c.markStatus);
router.post("/:id/refund", requirePermission("payments", "refund"), c.refund);

module.exports = router;
