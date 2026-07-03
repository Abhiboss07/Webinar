"use strict";
const express = require("express");
const router = express.Router();

const c = require("../controllers/paymentsController");
const { requireAuth, requireRole } = require("../middleware/auth");

const editor = [requireAuth, requireRole("admin", "editor")];
const adminOnly = [requireAuth, requireRole("admin")]; // refunds are admin-only

router.get("/", ...editor, c.list);
router.get("/stats", ...editor, c.stats);
router.get("/analytics", ...editor, c.analytics);
router.get("/export", ...editor, c.exportRows);
router.get("/:id", ...editor, c.getOne);
router.get("/:id/receipt", ...editor, c.receipt);
router.get("/:id/invoice", ...editor, c.invoice);
router.post("/:id/verify", ...editor, c.retryVerify);
router.post("/:id/status", ...editor, c.markStatus);
router.post("/:id/refund", ...adminOnly, c.refund);

module.exports = router;
