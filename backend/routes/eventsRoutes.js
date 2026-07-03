"use strict";
const express = require("express");
const router = express.Router();

const att = require("../controllers/attendanceController");
const cert = require("../controllers/certificateController");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { publicReadLimiter } = require("../middleware/rateLimit");

const view = requirePermission("events", "view");
const edit = requirePermission("events", "edit");

// ---- PUBLIC certificate verification (no auth) ----
router.get("/certificates/verify", publicReadLimiter, cert.verify);

// ---- Attendance ----
router.get("/attendance/dashboard", requireAuth, view, att.dashboard);
router.get("/attendance/analytics", requireAuth, view, att.analytics);
router.get("/attendance", requireAuth, view, att.list);
router.get("/attendance/:id/qr", requireAuth, view, att.qr);
router.post("/attendance/checkin", requireAuth, edit, att.checkin);
router.post("/attendance/:id/checkout", requireAuth, edit, att.checkout);

// ---- Certificates ----
router.get("/certificates/template", requireAuth, view, cert.getTemplate);
router.patch("/certificates/template", requireAuth, edit, cert.updateTemplate);
router.get("/certificates", requireAuth, view, cert.list);
router.post("/certificates/generate", requireAuth, requirePermission("events", "create"), cert.generate);
router.post("/certificates/bulk-generate", requireAuth, requirePermission("events", "create"), cert.bulkGenerate);
router.post("/certificates/zip", requireAuth, requirePermission("events", "export"), cert.downloadZip);
router.get("/certificates/:id/download", requireAuth, view, cert.download);
router.post("/certificates/:id/email", requireAuth, edit, cert.sendCertificate);
router.post("/certificates/:id/revoke", requireAuth, edit, cert.revoke);
router.post("/certificates/:id/reissue", requireAuth, edit, cert.reissue);

module.exports = router;
