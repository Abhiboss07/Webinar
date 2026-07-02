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
  } catch (err) {
    // Don't crash the payment flow if the DB is briefly unreachable — log loudly.
    // Content endpoints will error until Mongo recovers; payments still work.
    console.error("⚠  MongoDB connection failed at boot:", err.message);
  }

  app.listen(config.port, () => {
    console.log(`Youngness backend listening on :${config.port} (${config.env})`);
    if (!config.isConfigured()) {
      console.warn("⚠  Backend started but env is incomplete — some features will fail until configured.");
    }
  });
}

start();
