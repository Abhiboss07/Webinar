"use strict";
/**
 * Tracks where a media URL is used inside the site content (SiteConfig.data and
 * .draft) and rewrites it everywhere when an asset is replaced — so "replace an
 * asset → every section updates" works without hunting through fields by hand.
 */
const SiteConfig = require("../models/SiteConfig");

/** Count occurrences of a substring across every string value in a structure. */
function countInValue(node, needle) {
  if (typeof node === "string") return node.split(needle).length - 1;
  if (Array.isArray(node)) return node.reduce((n, x) => n + countInValue(x, needle), 0);
  if (node && typeof node === "object") return Object.values(node).reduce((n, x) => n + countInValue(x, needle), 0);
  return 0;
}

/** Deep-replace a substring in every string value; returns [newNode, replacedCount]. */
function replaceInValue(node, from, to) {
  if (typeof node === "string") {
    if (!node.includes(from)) return [node, 0];
    return [node.split(from).join(to), node.split(from).length - 1];
  }
  if (Array.isArray(node)) {
    let count = 0;
    const arr = node.map((x) => { const [v, c] = replaceInValue(x, from, to); count += c; return v; });
    return [arr, count];
  }
  if (node && typeof node === "object") {
    let count = 0;
    const obj = {};
    for (const k of Object.keys(node)) { const [v, c] = replaceInValue(node[k], from, to); obj[k] = v; count += c; }
    return [obj, count];
  }
  return [node, 0];
}

/** How many times `url` appears across published + draft content. */
async function countUsage(url) {
  if (!url) return 0;
  const doc = await SiteConfig.getSingleton();
  return countInValue(doc.data || {}, url) + countInValue(doc.draft || {}, url);
}

/** Replace `oldUrl` with `newUrl` across published + draft. Returns total replaced. */
async function propagateReplace(oldUrl, newUrl) {
  if (!oldUrl || oldUrl === newUrl) return 0;
  const doc = await SiteConfig.getSingleton();
  const [newData, c1] = replaceInValue(doc.data || {}, oldUrl, newUrl);
  const [newDraft, c2] = doc.draft ? replaceInValue(doc.draft, oldUrl, newUrl) : [doc.draft, 0];
  if (c1) { doc.data = newData; doc.markModified("data"); }
  if (c2) { doc.draft = newDraft; doc.markModified("draft"); }
  if (c1 || c2) await doc.save();
  return c1 + c2;
}

module.exports = { countUsage, propagateReplace };
