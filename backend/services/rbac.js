"use strict";
/**
 * RBAC definitions — resources, actions, and the default matrix for the seven
 * system roles. Permissions are stored per-role as { resource: { action: true } }.
 * Super Admin bypasses all checks. The seeded matrix is chosen so the previous
 * "admin"/"editor" behaviour is preserved (admin → full; content_editor → CMS).
 */
const RESOURCES = [
  "dashboard", "homepage_cms", "media", "workshops", "registrations",
  "payments", "analytics", "communication", "users", "roles", "settings", "api_keys", "backups",
];

const ACTIONS = ["view", "create", "edit", "delete", "publish", "export", "refund", "approve", "manage_users"];

/** Expand a compact spec { resource: [actions] } into { resource: { action: true } }. */
function perms(spec) {
  const out = {};
  for (const [res, acts] of Object.entries(spec)) out[res] = Object.fromEntries(acts.map((a) => [a, true]));
  return out;
}

const ALL = ["view", "create", "edit", "delete", "publish", "export", "refund", "approve", "manage_users"];

const DEFAULT_ROLES = [
  { key: "super_admin", name: "Super Admin", description: "Full access, including roles & permissions.", system: true, isSuperAdmin: true, permissions: {} },
  {
    key: "admin", name: "Admin", description: "Manages everything except the role matrix.", system: true, isSuperAdmin: false,
    permissions: perms({
      dashboard: ["view"], homepage_cms: ["view", "create", "edit", "delete", "publish"],
      media: ["view", "create", "edit", "delete"], workshops: ["view", "create", "edit", "delete", "publish"],
      registrations: ["view", "create", "edit", "delete", "export", "approve"],
      payments: ["view", "edit", "refund", "export"], analytics: ["view", "export"],
      communication: ["view", "create", "edit", "delete", "export"],
      users: ["view", "create", "edit", "delete", "manage_users"], settings: ["view", "edit"],
      api_keys: ["view", "edit"], backups: ["view", "create"],
    }),
  },
  {
    key: "manager", name: "Manager", description: "Runs workshops & content; no billing or users.", system: true,
    permissions: perms({
      dashboard: ["view"], homepage_cms: ["view", "edit", "publish"], media: ["view", "create", "edit"],
      workshops: ["view", "create", "edit", "publish"], registrations: ["view", "edit", "export", "approve"],
      payments: ["view", "export"], analytics: ["view", "export"], communication: ["view", "create", "edit"],
    }),
  },
  {
    key: "finance", name: "Finance", description: "Payments, refunds and financial exports.", system: true,
    permissions: perms({
      dashboard: ["view"], registrations: ["view", "export"],
      payments: ["view", "edit", "refund", "export"], analytics: ["view", "export"],
    }),
  },
  {
    key: "content_editor", name: "Content Editor", description: "Homepage, media and workshop content.", system: true,
    permissions: perms({
      dashboard: ["view"], homepage_cms: ["view", "edit", "publish"],
      media: ["view", "create", "edit", "delete"], workshops: ["view", "create", "edit", "publish"],
      registrations: ["view"],
    }),
  },
  {
    key: "support", name: "Support", description: "Assists participants; read-mostly.", system: true,
    permissions: perms({
      dashboard: ["view"], registrations: ["view", "edit", "export"],
      payments: ["view"], workshops: ["view"], media: ["view"],
    }),
  },
  {
    key: "viewer", name: "Viewer", description: "Read-only across the panel.", system: true,
    permissions: perms({
      dashboard: ["view"], homepage_cms: ["view"], media: ["view"], workshops: ["view"],
      registrations: ["view"], payments: ["view"], analytics: ["view"], communication: ["view"],
    }),
  },
];

/** Does a role grant (resource, action)? Super Admin always yes. */
function can(role, resource, action) {
  if (!role) return false;
  if (role.isSuperAdmin) return true;
  const p = role.permissions || {};
  return !!(p[resource] && p[resource][action]);
}

module.exports = { RESOURCES, ACTIONS, DEFAULT_ROLES, can };
