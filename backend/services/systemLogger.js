"use strict";
/** Persist app/error logs to SystemLog (best-effort; soft-capped at ~5000 rows). */
const SystemLog = require("../models/SystemLog");

let sinceTrim = 0;
async function record(level, category, message, meta = null) {
  try {
    await SystemLog.create({ level, category, message: String(message || "").slice(0, 800), meta });
    if (++sinceTrim >= 200) {
      sinceTrim = 0;
      const cutoff = await SystemLog.find().sort({ at: -1 }).skip(5000).limit(1).select("at").lean();
      if (cutoff[0]) await SystemLog.deleteMany({ at: { $lt: cutoff[0].at } });
    }
  } catch (_) { /* logging must never throw */ }
}

module.exports = { record };
