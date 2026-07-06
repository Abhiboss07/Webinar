"use strict";
/**
 * MongoDB connection (Mongoose). Called once at boot from server.js and by the
 * CLI scripts (seedAdmin, migrateConfig). Fails loud if MONGODB_URI is missing.
 *
 * Command buffering is DISABLED: a query issued while the DB is down fails
 * immediately with a clear error instead of the silent 10s
 * "Operation ... buffering timed out" hangs. server.js refuses to start until
 * this connection succeeds, and the driver auto-reconnects after drops.
 */
const mongoose = require("mongoose");
const config = require("./../config");

let connecting = null;
let eventsBound = false;

function bindConnectionEvents() {
  if (eventsBound) return;
  eventsBound = true;
  mongoose.connection.on("error", (err) => console.error("✗ MongoDB error:", err.message));
  mongoose.connection.on("disconnected", () => console.error("⚠  MongoDB disconnected — driver is retrying automatically"));
  mongoose.connection.on("reconnected", () => console.log("✓ MongoDB reconnected"));
}

async function connectDB() {
  if (mongoose.connection.readyState === 1) return mongoose.connection; // already connected
  if (connecting) return connecting;                                    // in-flight
  if (!config.mongoUri) throw new Error("MONGODB_URI is not configured");

  mongoose.set("strictQuery", true);
  mongoose.set("bufferCommands", false); // fail fast — never "buffering timed out"
  bindConnectionEvents();
  connecting = mongoose
    .connect(config.mongoUri, { serverSelectionTimeoutMS: 10000 })
    .then((m) => {
      console.log("✓ MongoDB connected");
      return m.connection;
    })
    .catch((err) => {
      connecting = null;
      throw err;
    });
  return connecting;
}

module.exports = { connectDB, mongoose };
