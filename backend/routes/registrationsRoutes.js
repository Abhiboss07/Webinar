"use strict";
const express = require("express");
const router = express.Router();

const c = require("../controllers/registrationsController");
const { requireAuth, requireRole } = require("../middleware/auth");

const editor = [requireAuth, requireRole("admin", "editor")];

// Static/specific paths BEFORE the dynamic /:id.
router.get("/", ...editor, c.list);
router.get("/stats", ...editor, c.stats);
router.get("/facets", ...editor, c.facets);
router.get("/export", ...editor, c.exportRows);
router.post("/bulk", ...editor, c.bulk);
router.get("/:id", ...editor, c.getOne);
router.patch("/:id", ...editor, c.patch);
router.post("/:id/notes", ...editor, c.addNote);
router.delete("/:id", ...editor, c.remove);

module.exports = router;
