"use strict";
/**
 * Express app — middleware, CORS, routes and error handling.
 * Kept separate from server.js so it can be imported in tests without listening.
 */
const path = require("path");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const config = require("./config");
const logger = require("./middleware/logger");
const sanitize = require("./middleware/sanitize");
const { apiLimiter } = require("./middleware/rateLimit");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const paymentRoutes = require("./routes/paymentRoutes");
const authRoutes = require("./routes/authRoutes");
const contentRoutes = require("./routes/contentRoutes");
const statsRoutes = require("./routes/statsRoutes");
const mediaRoutes = require("./routes/mediaRoutes");
const workshopRoutes = require("./routes/workshopRoutes");
const registrationsRoutes = require("./routes/registrationsRoutes");
const paymentsAdminRoutes = require("./routes/paymentsAdminRoutes");
const usersRoutes = require("./routes/usersRoutes");
const rolesRoutes = require("./routes/rolesRoutes");
const auditRoutes = require("./routes/auditRoutes");
const settingsRoutes = require("./routes/settingsRoutes");
const commRoutes = require("./routes/commRoutes");
const eventsRoutes = require("./routes/eventsRoutes");
const analyticsRoutes = require("./routes/analyticsRoutes");
const systemRoutes = require("./routes/systemRoutes");

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1); // behind Render/Cloudflare — needed for correct IPs + rate limiting
// Security headers. crossOriginResourcePolicy relaxed so the separately-hosted
// frontend/admin can consume the JSON API; this API serves no HTML of its own.
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" }, hsts: config.isProd ? undefined : false }));
app.use(compression()); // gzip/brotli responses
app.use(logger);
app.use(sanitize); // strip $-keys from query/params (NoSQL-injection guard)
app.use(express.json({ limit: "2mb" })); // content/backup PUTs can be larger than a payment payload

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

// Health + readiness (Render uses these).
app.get("/health", (req, res) => res.json({ status: "ok", env: config.env, configured: config.isConfigured() }));
app.get("/health/ready", (req, res) => {
  const { mongoose } = require("./db/connect");
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "not-ready", db: mongoose.connection.readyState });
});

// Broad rate-limit across the API surface (per-route limiters stay stricter).
app.use("/api", apiLimiter);

// SEO: robots.txt + sitemap.xml generated from Settings (white-label).
const settingsController = require("./controllers/settingsController");
app.get("/robots.txt", settingsController.robotsTxt);
app.get("/sitemap.xml", settingsController.sitemapXml);

// Local media files (only used when STORAGE_PROVIDER=local; Cloudinary serves
// its own CDN URLs in production). CORS-friendly so the site/admin can load them.
app.use("/uploads", express.static(path.resolve(process.cwd(), config.storage.uploadDir), {
  setHeaders: (res) => res.set("Access-Control-Allow-Origin", "*"),
}));

// ---- CMS / admin API ----
app.use("/api/auth", authRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/media", mediaRoutes);
app.use("/api/workshops", workshopRoutes);
app.use("/api/registrations", registrationsRoutes);
app.use("/api/payments", paymentsAdminRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/roles", rolesRoutes);
app.use("/api/audit", auditRoutes);
app.use("/api/settings", settingsRoutes);
app.use("/api/comm", commRoutes);
app.use("/api", eventsRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/system", systemRoutes);
app.use("/api", contentRoutes);

// ---- Payment / registration routes (unchanged public flow) ----
app.use("/", paymentRoutes);

// 404 + error fallthrough.
app.use(notFound);
app.use(errorHandler);

module.exports = app;
