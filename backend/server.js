"use strict";
/**
 * Youngness Webinar — backend entry point. Fail-fast startup order:
 *
 *   1. Validate env (missing vars AND leftover template placeholders).
 *      In production a half-configured payment system must not serve traffic.
 *   2. Connect MongoDB — Express, workers, queues and seeds all wait for it.
 *      If the DB is unreachable the process EXITS (no silent "buffering" mode);
 *      the host (Render/Docker) restarts it until the DB is reachable.
 *   3. Bootstrap accounts (admin + Razorpay demo) — create-if-missing only.
 *   4. Start background workers.
 *   5. Listen.
 *
 * The Razorpay Key Secret and JWT secret stay on the server; only the public
 * Razorpay Key ID ever reaches the browser.
 */
const app = require("./app");
const config = require("./config");
const { connectDB } = require("./db/connect");

// Last-resort safety net: log WHAT killed the process before the host
// restarts it (otherwise Render logs end in a bare stack trace).
process.on("uncaughtException", (err) => {
  console.error("✗ FATAL uncaughtException:", err && err.stack ? err.stack : err);
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error("✗ FATAL unhandledRejection:", reason && reason.stack ? reason.stack : reason);
  process.exit(1);
});

async function start() {
  // 1) Environment. Production refuses to boot half-configured.
  const problems = config.envProblems();
  if (problems.length) {
    console.error("✗ Environment is not production-ready:");
    for (const p of problems) console.error(`   - ${p}`);
    if (config.isProd) {
      console.error("Refusing to start. Set the variables above on the host (Render → Environment) and redeploy.");
      process.exit(1);
    }
    console.warn("⚠  Continuing anyway because NODE_ENV=development — production would exit here.");
  }

  // 2) MongoDB must be connected before ANYTHING else runs.
  try {
    await connectDB();
  } catch (err) {
    console.error("✗ MongoDB connection failed — refusing to start:", err.message);
    console.error("   Check MONGODB_URI and the Atlas network access list (Render needs 0.0.0.0/0).");
    process.exit(1);
  }

  // 3) Bootstrap accounts (idempotent — create only if missing, never duplicate).
  try {
    const { ensureAdminUser } = require("./scripts/seedAdmin");
    const admin = await ensureAdminUser();
    if (admin) console.log(`✓ Admin account ${admin.isNew ? "created" : "present"}: ${admin.user.email}`);
    else console.warn("⚠  ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin bootstrap (run `npm run seed:admin` manually).");
  } catch (e) {
    console.error("⚠  Admin bootstrap failed:", e.message);
  }
  try {
    const { ensureRazorpayDemoUser } = require("./scripts/seedRazorpayDemo");
    const { user, isNew } = await ensureRazorpayDemoUser();
    console.log(`✓ Razorpay demo account ${isNew ? "created" : "verified"}: ${user.email}`);
  } catch (e) {
    console.error("⚠  Razorpay demo account seed failed:", e.message);
  }

  // 4) Background workers — only now that the DB is ready.
  require("./services/commQueue").startWorker(parseInt(process.env.COMM_WORKER_MS || "15000", 10));
  require("./services/scheduledBackup").start(process.env.BACKUP_INTERVAL_HOURS);

  // 5) Serve.
  app.listen(config.port, () => {
    console.log(`Youngness backend listening on :${config.port} (${config.env})`);
  });
}

start().catch((err) => {
  console.error("✗ Fatal startup error:", err.message);
  process.exit(1);
});
