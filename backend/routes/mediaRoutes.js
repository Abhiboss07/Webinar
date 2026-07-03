"use strict";
const express = require("express");
const multer = require("multer");
const router = express.Router();

const c = require("../controllers/mediaController");
const config = require("../config");
const { requireAuth, requirePermission } = require("../middleware/auth");
const { writeLimiter } = require("../middleware/rateLimit");

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: config.storage.maxBytes, files: 1 } });
function single(field) {
  return (req, res, next) => upload.single(field)(req, res, (err) => {
    if (err) {
      const msg = err.code === "LIMIT_FILE_SIZE" ? `File too large (max ${Math.round(config.storage.maxBytes / (1024 * 1024))}MB)` : err.message || "Upload error";
      return res.status(400).json({ status: "error", message: msg });
    }
    next();
  });
}

router.get("/", requireAuth, requirePermission("media", "view"), c.list);
router.post("/", requireAuth, requirePermission("media", "create"), writeLimiter, single("file"), c.upload);
router.get("/:id", requireAuth, requirePermission("media", "view"), c.getOne);
router.patch("/:id", requireAuth, requirePermission("media", "edit"), c.patch);
router.post("/:id/replace", requireAuth, requirePermission("media", "edit"), writeLimiter, single("file"), c.replace);
router.delete("/:id", requireAuth, requirePermission("media", "delete"), c.remove);

module.exports = router;
