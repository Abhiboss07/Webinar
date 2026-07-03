"use strict";
/** Role & permission management. System roles can be edited (permissions) but not
 *  deleted; the Super Admin flag/key is immutable. Editing clears the role cache
 *  so permission changes take effect immediately. */
const Role = require("../models/Role");
const User = require("../models/User");
const audit = require("../services/audit");
const { clean } = require("../utils/helpers");
const { RESOURCES, ACTIONS } = require("../services/rbac");
const { clearRoleCache } = require("../middleware/auth");

function sanitizePermissions(input) {
  const out = {};
  if (!input || typeof input !== "object") return out;
  for (const res of RESOURCES) {
    if (input[res] && typeof input[res] === "object") {
      const acts = {};
      for (const a of ACTIONS) if (input[res][a]) acts[a] = true;
      if (Object.keys(acts).length) out[res] = acts;
    }
  }
  return out;
}

async function list(req, res) {
  try {
    const roles = await Role.find({}).sort({ isSuperAdmin: -1, name: 1 }).lean();
    const counts = await User.aggregate([{ $group: { _id: "$role", n: { $sum: 1 } } }]);
    const cmap = Object.fromEntries(counts.map((c) => [c._id, c.n]));
    return res.json({ status: "success", roles: roles.map((r) => ({ ...r, userCount: cmap[r.key] || 0 })), resources: RESOURCES, actions: ACTIONS });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Could not list roles" });
  }
}

async function create(req, res) {
  try {
    const b = req.body || {};
    const key = clean(b.key).toLowerCase().replace(/[^a-z0-9_]+/g, "_");
    const name = clean(b.name);
    if (!key || !name) return res.status(400).json({ status: "error", message: "key and name are required" });
    if (await Role.exists({ key })) return res.status(409).json({ status: "error", message: "Role key already exists" });
    const role = await Role.create({ key, name, description: clean(b.description), permissions: sanitizePermissions(b.permissions), system: false, isSuperAdmin: false });
    await audit.record(req, "role.create", { resource: "roles", targetId: role.key, newValue: { key, name } });
    return res.status(201).json({ status: "success", role });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Could not create role" });
  }
}

async function update(req, res) {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ status: "error", message: "Role not found" });
    const b = req.body || {};
    const before = { name: role.name, permissions: role.permissions };
    if (b.name != null) role.name = clean(b.name);
    if (b.description != null) role.description = clean(b.description);
    if (b.permissions != null && !role.isSuperAdmin) { role.permissions = sanitizePermissions(b.permissions); role.markModified("permissions"); }
    await role.save();
    clearRoleCache(); // permission changes take effect immediately
    await audit.record(req, "role.update", { resource: "roles", targetId: role.key, oldValue: before, newValue: { name: role.name, permissions: role.permissions } });
    return res.json({ status: "success", role });
  } catch (err) {
    console.error("[roles/update]", err.message);
    return res.status(500).json({ status: "error", message: "Could not update role" });
  }
}

async function remove(req, res) {
  try {
    const role = await Role.findById(req.params.id);
    if (!role) return res.status(404).json({ status: "error", message: "Role not found" });
    if (role.system) return res.status(400).json({ status: "error", message: "System roles cannot be deleted" });
    if (await User.exists({ role: role.key })) return res.status(409).json({ status: "error", message: "Reassign users on this role before deleting it" });
    await role.deleteOne();
    clearRoleCache();
    await audit.record(req, "role.delete", { resource: "roles", targetId: role.key });
    return res.json({ status: "success" });
  } catch (err) {
    return res.status(500).json({ status: "error", message: "Could not delete role" });
  }
}

module.exports = { list, create, update, remove };
