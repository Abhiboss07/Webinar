"use strict";
/**
 * Express app — middleware, CORS, routes and error handling.
 * Kept separate from server.js so it can be imported in tests without listening.
 */
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const config = require("./config");
const logger = require("./middleware/logger");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const paymentRoutes = require("./routes/paymentRoutes");
const authRoutes = require("./routes/authRoutes");
const contentRoutes = require("./routes/contentRoutes");
const statsRoutes = require("./routes/statsRoutes");
const mediaRoutes = require("./routes/mediaRoutes");

const app = express();

app.disable("x-powered-by");
// Security headers. crossOriginResourcePolicy relaxed so the separately-hosted
// frontend/admin can consume the JSON API; this API serves no HTML of its own.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(logger);
app.use(express.json({ limit: "1mb" })); // content PUTs can be larger than a payment payload

// CORS — allow the configured site origin(s). With no allow-list configured in
// production, browser requests are rejected (fail safe).
app.use(cors({
  origin: function (origin, cb) {
    if (!origin) return cb(null, true); // same-origin / curl / server-to-server
    if (config.allowedOrigins.includes("*") || config.allowedOrigins.includes(origin.replace(/\/$/, ""))) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  methods: ["POST", "GET", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Health check (Render uses this).
app.get("/health", (req, res) => res.json({ status: "ok", env: config.env, configured: config.isConfigured() }));

// Local media files (only used when STORAGE_PROVIDER=local; Cloudinary serves
// its own CDN URLs in production). CORS-friendly so the site/admin can load them.
app.use("/uploads", express.static(path.resolve(process.cwd(), config.storage.uploadDir), {
  setHeaders: (res) => res.set("Access-Control-Allow-Origin", "*"),
}));

// ---- CMS / admin API ----
app.use("/api/auth", authRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api", contentRoutes);

// ---- Payment / registration routes (unchanged public flow) ----
app.use("/", paymentRoutes);

// 404 + error fallthrough.
app.use(notFound);
app.use(errorHandler);

module.exports = app;
