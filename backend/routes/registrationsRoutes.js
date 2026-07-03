"use strict";
const express = require("express");
const router = express.Router();

const c = require("../controllers/registrationsController");
const { requireAuth, requirePermission } = require("../middleware/auth");

const view = requirePermission("registrations", "view");

router.use(requireAuth);
router.get("/", view, c.list);
router.get("/stats", view, c.stats);
router.get("/facets", view, c.facets);
router.get("/export", requirePermission("registrations", "export"), c.exportRows);
router.post("/bulk", requirePermission("registrations", "edit"), c.bulk); // delete action re-checked in controller
router.get("/:id", view, c.getOne);
router.patch("/:id", requirePermission("registrations", "edit"), c.patch);
router.post("/:id/notes", requirePermission("registrations", "edit"), c.addNote);
router.delete("/:id", requirePermission("registrations", "delete"), c.remove);

module.exports = router;
