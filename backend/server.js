"use strict";
/**
 * Youngness Webinar — payment backend entry point.
 * Starts the Express app (see app.js). The Razorpay Key Secret stays here on
 * the server; only the public Key ID ever reaches the browser.
 */
const app = require("./app");
const config = require("./config");

app.listen(config.port, () => {
  console.log(`Youngness payment backend listening on :${config.port} (${config.env})`);
  if (!config.isConfigured()) {
    console.warn("⚠  Backend started but env is incomplete — payments will fail until configured.");
  }
});
