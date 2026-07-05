"use strict";
/**
 * Config/content backup + restore. Restore NEVER touches Users / Sessions /
 * AuditLog (so a restore can't lock admins out or wipe the audit trail). Data
 * collections (registrations/certificates/messages) are included only when
 * includeData=true.
 *
 * The payload is stored as a JSON STRING and the checksum is sha256 of that
 * string — deterministic across Mongo round-trips (no BSON re-ordering issues).
 * On restore, Mongoose insertMany casts string ids / ISO dates back to their
 * schema types.
 */
const crypto = require("crypto");
const SiteConfig = require("../models/SiteConfig");
const Settings = require("../models/Settings");
const Workshop = require("../models/Workshop");
const MessageTemplate = require("../models/MessageTemplate");
const CertificateTemplate = require("../models/CertificateTemplate");
const Role = require("../models/Role");
const Registration = require("../models/Registration");
const Certificate = require("../models/Certificate");
const Message = require("../models/Message");

const CONFIG_MODELS = { SiteConfig, Settings, Workshop, MessageTemplate, CertificateTemplate, Role };
const DATA_MODELS = { Registration, Certificate, Message };
const RESTORABLE = { ...CONFIG_MODELS, ...DATA_MODELS };

const sha256 = (s) => crypto.createHash("sha256").update(s).digest("hex");
const asString = (v) => (typeof v === "string" ? v : JSON.stringify(v));

async function createBackup({ includeData = false } = {}) {
  const data = {}; const collections = [];
  const models = includeData ? { ...CONFIG_MODELS, ...DATA_MODELS } : CONFIG_MODELS;
  for (const [name, Model] of Object.entries(models)) {
    const docs = await Model.find({}).limit(50000).lean();
    data[name] = docs; collections.push({ name, count: docs.length });
  }
  const dataString = JSON.stringify(data);
  return { dataString, collections, size: Buffer.byteLength(dataString), checksum: sha256(dataString) };
}

async function restore(input) {
  const data = typeof input === "string" ? JSON.parse(input) : input;
  const results = [];
  for (const [name, docs] of Object.entries(data || {})) {
    const Model = RESTORABLE[name];
    if (!Model || !Array.isArray(docs)) continue;
    await Model.deleteMany({});
    if (docs.length) await Model.insertMany(docs, { ordered: false }).catch(() => {});
    results.push({ name, restored: docs.length });
  }
  return results;
}

const verify = (input, checksum) => sha256(asString(input)) === checksum;

module.exports = { createBackup, restore, verify, CONFIG_MODELS: Object.keys(CONFIG_MODELS), RESTORABLE: Object.keys(RESTORABLE) };
