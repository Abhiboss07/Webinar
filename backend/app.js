"use strict";
/**
 * Express app — middleware, CORS, routes and error handling.
 * Kept separate from server.js so it can be imported in tests without listening.
 */
const express = require("express");
const cors = require("cors");
const config = require("./config");
const logger = require("./middleware/logger");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const paymentRoutes = require("./routes/paymentRoutes");

const app = express();

app.disable("x-powered-by");
app.use(logger);
app.use(express.json({ limit: "256kb" }));

// CORS — allow the configured site origin(s). With no allow-list configured in
// production, browser requests are rejected (fail safe).
app.use(cors({
  origin: function (origin, cb) {
    if (!origin) return cb(null, true); // same-origin / curl / server-to-server
    if (config.allowedOrigins.includes("*") || config.allowedOrigins.includes(origin.replace(/\/$/, ""))) return cb(null, true);
    return cb(new Error("Not allowed by CORS"));
  },
  methods: ["POST", "GET", "OPTIONS"],
}));

// Health check (Render uses this).
app.get("/health", (req, res) => res.json({ status: "ok", env: config.env, configured: config.isConfigured() }));

// API routes.
app.use("/", paymentRoutes);

// 404 + error fallthrough.
app.use(notFound);
app.use(errorHandler);

module.exports = app;
