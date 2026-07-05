"use strict";
const express = require("express");
const router = express.Router();

const c = require("../controllers/systemController");
const { requireAuth, requirePermission, requireRole } = require("../middleware/auth");

const view = requirePermission("system", "view");
const edit = requirePermission("system", "edit");

router.use(requireAuth);
router.get("/overview", view, c.overview);
router.get("/health", view, c.health);
router.get("/storage", view, c.storage);
router.get("/queue", view, c.queue);
router.get("/logs", view, c.logs);
router.get("/environment", view, c.environment);
router.get("/security", view, c.security);
router.get("/notifications", view, c.notifications);
router.get("/maintenance", view, c.getMaintenance);
router.post("/maintenance", edit, c.setMaintenance);
router.get("/audit/export", view, c.auditExport);

// Backups
router.get("/backups", view, c.listBackups);
router.post("/backups", edit, c.createBackup);
router.get("/backups/:id/download", view, c.downloadBackup);
router.post("/backups/:id/verify", edit, c.verifyBackup);
// Restore is destructive → Super Admin only.
router.post("/backups/:id/restore", requireRole("super_admin"), c.restoreBackup);
router.post("/restore", requireRole("super_admin"), c.restoreBackup);

module.exports = router;
