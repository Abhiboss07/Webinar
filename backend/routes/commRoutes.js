"use strict";
const express = require("express");
const router = express.Router();

const c = require("../controllers/commController");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { writeLimiter } = require("../middleware/rateLimit");

const view = requirePermission("communication", "view");
const edit = requirePermission("communication", "edit");

router.use(requireAuth);
router.get("/dashboard", view, c.dashboard);

// Templates
router.get("/templates", view, c.listTemplates);
router.post("/templates", requirePermission("communication", "create"), c.createTemplate);
router.post("/templates/preview", view, c.previewTemplate);
router.get("/templates/:id", view, c.getTemplate);
router.patch("/templates/:id", edit, c.updateTemplate);
router.post("/templates/:id/duplicate", requirePermission("communication", "create"), c.duplicateTemplate);
router.delete("/templates/:id", requirePermission("communication", "delete"), c.deleteTemplate);

// History + queue
router.get("/history", view, c.history);
router.post("/queue/process", edit, c.processQueue);
router.post("/queue/retry", edit, c.retryQueue);
router.post("/queue/cancel", edit, c.cancelQueue);
router.post("/queue/pause", edit, c.pauseQueue);

// Triggers
router.get("/triggers", view, c.getTriggers);
router.post("/triggers", edit, c.setTriggers);

// Sending
router.post("/send-test", edit, writeLimiter, c.sendTest);
router.post("/send-bulk", edit, writeLimiter, c.sendBulk);

module.exports = router;
