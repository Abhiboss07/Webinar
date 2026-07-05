"use strict";
/** The communication queue — enqueue, process due messages (with retry/backoff),
 *  retry/cancel, pause/resume, and a background worker. */
const Message = require("../models/Message");
const CommState = require("../models/CommState");
const { dispatch } = require("./dispatcher");

async function enqueue(msg) {
  return Message.create({ ...msg, status: "queued", scheduledFor: msg.scheduledFor || new Date() });
}

let running = false;
/** Send all due queued messages (respects pause). Returns { processed, sent, failed }. */
async function processDue(limit = 25) {
  if (running) return { skipped: true };
  const state = await CommState.getSingleton();
  if (state.paused) return { paused: true, processed: 0 };
  running = true;
  let sent = 0, failed = 0, processed = 0;
  try {
    const due = await Message.find({ status: "queued", scheduledFor: { $lte: new Date() } }).sort({ scheduledFor: 1 }).limit(limit);
    for (const msg of due) {
      processed += 1;
      msg.status = "sending"; await msg.save();
      try {
        const { providerResult } = await dispatch(msg);
        msg.status = "sent"; msg.sentAt = new Date(); msg.providerResult = providerResult; msg.error = "";
        sent += 1;
      } catch (err) {
        msg.retries += 1; msg.error = err.message || "send failed";
        if (msg.retries > msg.maxRetries) msg.status = "failed";
        else { msg.status = "queued"; msg.scheduledFor = new Date(Date.now() + Math.min(msg.retries, 5) * 30000); }
        failed += 1;
      }
      await msg.save();
    }
  } finally { running = false; }
  return { processed, sent, failed };
}

async function retryFailed(ids) {
  const filter = ids && ids.length ? { _id: { $in: ids }, status: "failed" } : { status: "failed" };
  const r = await Message.updateMany(filter, { $set: { status: "queued", scheduledFor: new Date(), retries: 0, error: "" } });
  return r.modifiedCount;
}
async function cancel(ids) {
  const filter = ids && ids.length ? { _id: { $in: ids }, status: { $in: ["queued", "failed"] } } : { status: "queued" };
  const r = await Message.updateMany(filter, { $set: { status: "cancelled" } });
  return r.modifiedCount;
}
async function setPaused(paused) { const s = await CommState.getSingleton(); s.paused = !!paused; await s.save(); return s.paused; }
async function isPaused() { return (await CommState.getSingleton()).paused; }

let timer = null;
function startWorker(ms = 15000) {
  if (timer) return;
  timer = setInterval(() => { processDue().catch((e) => console.error("[commQueue] worker:", e.message)); }, ms);
  if (timer.unref) timer.unref();
}

module.exports = { enqueue, processDue, retryFailed, cancel, setPaused, isPaused, startWorker };
