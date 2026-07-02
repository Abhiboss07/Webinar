"use strict";
const express = require("express");
const multer = require("multer");
const router = express.Router();

const c = require("../controllers/mediaController");
const config = require("../config");
const { requireAuth, requireRole } = require("../middleware/auth");
const { writeLimiter } = require("../middleware/rateLimit");

const editor = [requireAuth, requireRole("admin", "editor")];

// In-memory upload → handed to the storage adapter. Bounded by config.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.storage.maxBytes, files: 1 },
});

// Translate multer errors (e.g. file too large) into clean 400s.
function single(field) {
  return (req, res, next) => upload.single(field)(req, res, (err) => {
    if (err) {
      const msg = err.code === "LIMIT_FILE_SIZE"
        ? `File too large (max ${Math.round(config.storage.maxBytes / (1024 * 1024))}MB)`
        : err.message || "Upload error";
      return res.status(400).json({ status: "error", message: msg });
    }
    next();
  });
}

router.get("/", ...editor, c.list);
router.post("/", ...editor, writeLimiter, single("file"), c.upload);
router.get("/:id", ...editor, c.getOne);
router.patch("/:id", ...editor, c.patch);
router.post("/:id/replace", ...editor, writeLimiter, single("file"), c.replace);
router.delete("/:id", ...editor, c.remove);

module.exports = router;
