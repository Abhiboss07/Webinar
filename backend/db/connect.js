"use strict";
/**
 * MongoDB connection (Mongoose). Called once at boot from server.js and by the
 * CLI scripts (seedAdmin, migrateConfig). Fails loud if MONGODB_URI is missing.
 */
const mongoose = require("mongoose");
const config = require("./../config");

let connecting = null;

async function connectDB() {
  if (mongoose.connection.readyState === 1) return mongoose.connection; // already connected
  if (connecting) return connecting;                                    // in-flight
  if (!config.mongoUri) throw new Error("MONGODB_URI is not configured");

  mongoose.set("strictQuery", true);
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
