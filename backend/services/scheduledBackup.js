"use strict";
/** Automatic config backups on an interval (opt-in via BACKUP_INTERVAL_HOURS).
 *  Keeps the most recent 10 scheduled backups. */
const Backup = require("../models/Backup");
const backupSvc = require("./backup");

async function runScheduledBackup() {
  try {
    const b = await backupSvc.createBackup({ includeData: false });
    await Backup.create({ kind: "scheduled", collections: b.collections, includeData: false, size: b.size, checksum: b.checksum, verified: true, data: b.dataString, by: "system" });
    const old = await Backup.find({ kind: "scheduled" }).sort({ createdAt: -1 }).skip(10).select("_id").lean();
    if (old.length) await Backup.deleteMany({ _id: { $in: old.map((o) => o._id) } });
    console.log(`✓ scheduled backup taken (${b.size} bytes)`);
  } catch (e) { console.error("[scheduledBackup]", e.message); }
}

let timer = null;
function start(hours) {
  const h = Number(hours) || 0;
  if (h <= 0 || timer) return;
  timer = setInterval(runScheduledBackup, h * 3600000);
  if (timer.unref) timer.unref();
  console.log(`⏱  automatic config backups every ${h}h`);
}

module.exports = { start, runScheduledBackup };
