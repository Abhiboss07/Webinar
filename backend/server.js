"use strict";
/**
 * Youngness Webinar — backend entry point.
 * Connects to MongoDB (CMS content + admin users), then starts the Express app
 * (see app.js). The Razorpay Key Secret and JWT secret stay on the server; only
 * the public Razorpay Key ID ever reaches the browser.
 */
const app = require("./app");
const config = require("./config");
const { connectDB } = require("./db/connect");

async function start() {
  try {
    await connectDB();
    // Razorpay verification/demo login (idempotent — creates only if missing,
    // repairs password/role drift). See scripts/seedRazorpayDemo.js.
    try {
      const { ensureRazorpayDemoUser } = require("./scripts/seedRazorpayDemo");
      const { user, isNew } = await ensureRazorpayDemoUser();
      console.log(`✓ Razorpay demo account ${isNew ? "created" : "verified"}: ${user.email}`);
    } catch (e) {
      console.error("⚠  Razorpay demo account seed failed:", e.message);
    }
  } catch (err) {
    // Don't crash the payment flow if the DB is briefly unreachable — log loudly.
    // Content endpoints will error until Mongo recovers; payments still work.
    console.error("⚠  MongoDB connection failed at boot:", err.message);
  }

  // Background worker: drain the communication queue on an interval.
  try { require("./services/commQueue").startWorker(parseInt(process.env.COMM_WORKER_MS || "15000", 10)); }
  catch (e) { console.error("⚠  comm worker not started:", e.message); }

  // Automatic config backups (opt-in via BACKUP_INTERVAL_HOURS).
  try { require("./services/scheduledBackup").start(process.env.BACKUP_INTERVAL_HOURS); }
  catch (e) { console.error("⚠  scheduled backups not started:", e.message); }

  app.listen(config.port, () => {
    console.log(`Youngness backend listening on :${config.port} (${config.env})`);
    if (!config.isConfigured()) {
      console.warn("⚠  Backend started but env is incomplete — some features will fail until configured.");
    }
  });
}

start();
